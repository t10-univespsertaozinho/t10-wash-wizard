/**
 * Regressão de privacidade e LGPD.
 *
 * Três propriedades que nenhuma suíte cobria e que são invisíveis no uso normal
 * — um log vaza em silêncio, um cabeçalho ausente só aparece no navegador de
 * outra pessoa, e uma coluna nova no schema passa a trafegar sozinha:
 *
 *   1. nenhum dado pessoal chega ao log do servidor (Art. 6º, VII e VIII);
 *   2. nenhuma resposta privada pode ser guardada em cache;
 *   3. cada endpoint devolve só as colunas que a tela lê (Art. 6º, III).
 *
 * Mais a prova de que as consultas seguem parametrizadas e de que os
 * identificadores interpolados continuam presos a uma allowlist.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { request, app, db, prepararBanco, autenticar, criarLavagem, USUARIOS } from './helpers.js';
import { excluirComAuditoria } from '../server.js';
import { sanitizarErroParaLog, CAMPOS_SENSIVEIS_PG } from '../log-seguro.js';

const CACHE_ESPERADO = 'no-store, no-cache, must-revalidate, private';

// E-mail distintivo: se ele aparecer em qualquer lugar do log, o vazamento é
// inequívoco — não é uma substring que poderia vir de outra fonte.
const EMAIL_PESSOAL = 'maria.privada@exemplo.com';

const anexarCsv = (req, tabela, conteudo) =>
  req.attach(`${tabela}.csv`, Buffer.from(conteudo, 'utf8'), `${tabela}.csv`);

describe('sanitizarErroParaLog — campos do pg que carregam valor de linha', () => {
  // Reproduz um DatabaseError do `pg` como ele chega numa violação de unicidade.
  const erroDoBanco = () => Object.assign(
    new Error('duplicate key value violates unique constraint "users_email_key"'),
    {
      code: '23505',
      constraint: 'users_email_key',
      table: 'users',
      detail: `Key (email)=(${EMAIL_PESSOAL}) already exists.`,
      where: `INSERT INTO clientes ... '(16) 99999-0000'`,
      query: 'INSERT INTO users (email) VALUES ($1)',
      parameters: [EMAIL_PESSOAL],
    }
  );

  it('descarta detail, where, query e parameters', () => {
    const seguro = sanitizarErroParaLog(erroDoBanco());

    for (const campo of CAMPOS_SENSIVEIS_PG) {
      expect(seguro, campo).not.toHaveProperty(campo);
    }
    // Serializado é como o log realmente sai: nem o e-mail nem o telefone sobrevivem.
    const serializado = JSON.stringify(seguro);
    expect(serializado).not.toContain(EMAIL_PESSOAL);
    expect(serializado).not.toContain('99999-0000');
    expect(serializado).not.toContain('Key (');
  });

  it('preserva o que serve para diagnosticar', () => {
    const seguro = sanitizarErroParaLog(erroDoBanco());

    expect(seguro).toMatchObject({ code: '23505', constraint: 'users_email_key', table: 'users' });
    expect(seguro.message).toContain('users_email_key');
    expect(seguro.stack).toBeTruthy();
  });

  it('não quebra com valor que não é objeto', () => {
    expect(sanitizarErroParaLog('falha solta')).toMatchObject({ message: 'falha solta' });
    expect(sanitizarErroParaLog(null)).toMatchObject({ message: 'null' });
  });
});

describe('Erro de banco não vaza dado pessoal no log nem na resposta', () => {
  let tokenAdmin;
  let capturado;

  beforeEach(async () => {
    await prepararBanco();
    tokenAdmin = await autenticar('admin');

    // Captura tudo o que o servidor escreveria no log do Render durante o caso.
    capturado = [];
    const registrar = (...args) => { capturado.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
    vi.spyOn(console, 'warn').mockImplementation(registrar);
    vi.spyOn(console, 'error').mockImplementation(registrar);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Caminho real até o SQLSTATE 23505: o import insere as linhas direto, sem a
   * pré-checagem de e-mail duplicado que o POST /api/users faz. É aqui que o
   * `err.detail` do PostgreSQL — com o e-mail conflitante dentro — chegava ao
   * `console.warn`.
   */
  const importarUsuariosDuplicados = () => anexarCsv(
    request(app).post('/api/backup/import').set('Authorization', `Bearer ${tokenAdmin}`),
    'users',
    'id,email,nome,role\n' +
    `u1,${EMAIL_PESSOAL},Maria,operador\n` +
    `u2,${EMAIL_PESSOAL},Maria Duplicada,operador\n`
  );

  it('o log registra a constraint, nunca o e-mail conflitante', async () => {
    const res = await importarUsuariosDuplicados();
    expect(res.status).toBe(409);

    const log = capturado.join('\n');
    // O caso só prova algo se o servidor realmente logou alguma coisa.
    expect(log).toContain('23505');
    expect(log).not.toContain(EMAIL_PESSOAL);
    expect(log).not.toContain('Key (');
    expect(log).not.toContain('already exists');
  });

  it('a resposta traz mensagem genérica, sem detalhe interno do PostgreSQL', async () => {
    const res = await importarUsuariosDuplicados();

    expect(res.body).toEqual({ error: 'Já existe um registro com este valor único.' });
    for (const campo of ['stack', 'detail', 'code', 'constraint', 'table', 'where', 'query']) {
      expect(res.body, campo).not.toHaveProperty(campo);
    }
    expect(JSON.stringify(res.body)).not.toContain(EMAIL_PESSOAL);
  });

  it('o rollback preserva os usuários originais', async () => {
    await importarUsuariosDuplicados();
    expect(await db.get('SELECT count(*) c FROM users')).toMatchObject({ c: 2 });
  });
});

describe('Cabeçalhos de cache nas rotas da API', () => {
  let token;

  beforeEach(async () => {
    await prepararBanco();
    token = await autenticar('admin');
  });

  const esperarSemCache = (res) => {
    expect(res.headers['cache-control']).toBe(CACHE_ESPERADO);
    expect(res.headers['pragma']).toBe('no-cache');
    expect(res.headers['expires']).toBe('0');
  };

  it.each([
    ['/api/clientes'],
    ['/api/veiculos'],
    ['/api/lavagens'],
    ['/api/produtos'],
    ['/api/movimentacoes'],
    ['/api/dashboard/stats'],
  ])('%s responde no-store', async (rota) => {
    const res = await request(app).get(rota).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    esperarSemCache(res);
  });

  it('o login também não pode ser cacheado', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USUARIOS.admin.email, senha: USUARIOS.admin.senha });

    expect(res.status).toBe(200);
    esperarSemCache(res);
  });

  it('vale até na resposta de erro, que também pode carregar contexto', async () => {
    const res = await request(app).get('/api/clientes');
    expect(res.status).toBe(401);
    esperarSemCache(res);
  });
});

describe('Minimização de dados nas listagens', () => {
  let token;

  beforeEach(async () => {
    await prepararBanco();
    token = await autenticar('admin');

    await criarLavagem({ status: 'concluida', pagamento: 'PIX', data_conclusao: new Date().toISOString() });
    await db.run(
      `INSERT INTO produtos (id, nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['prod-teste', 'Shampoo', 10, 5, 'Limpeza', 'L', 19.9, USUARIOS.admin.id, new Date().toISOString()]
    );
    await db.run(
      `INSERT INTO movimentacoes (id, produto_id, tipo, quantidade, observacao, user_id, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['mov-teste', 'prod-teste', 'saida', 2, 'anotação interna do balcão', USUARIOS.admin.id, new Date().toISOString()]
    );
  });

  const COLUNAS_ESPERADAS = {
    '/api/clientes': ['id', 'nome', 'telefone', 'data_nascimento', 'created_at'],
    '/api/veiculos': ['id', 'cliente_id', 'modelo', 'placa', 'cor', 'marca'],
    '/api/tipos-lavagem': ['id', 'nome', 'descricao', 'preco'],
    '/api/lavagens': ['id', 'cliente_id', 'veiculo_id', 'tipo_lavagem_id', 'status', 'valor', 'data', 'pagamento', 'observacao', 'data_conclusao'],
    '/api/produtos': ['id', 'nome', 'categoria', 'quantidade', 'estoque_minimo', 'unidade', 'preco_unitario'],
    '/api/movimentacoes': ['id', 'produto_id', 'tipo', 'quantidade', 'data'],
  };

  it.each(Object.entries(COLUNAS_ESPERADAS))('%s devolve exatamente a allowlist', async (rota, colunas) => {
    const res = await request(app).get(rota).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length, `${rota} precisa de pelo menos uma linha para o caso valer`).toBeGreaterThan(0);
    expect(Object.keys(res.body[0]).sort()).toEqual([...colunas].sort());
  });

  it('nenhuma listagem expõe o user_id de quem cadastrou', async () => {
    for (const rota of Object.keys(COLUNAS_ESPERADAS)) {
      const res = await request(app).get(rota).set('Authorization', `Bearer ${token}`);
      expect(res.body[0], rota).not.toHaveProperty('user_id');
    }
  });

  it('a observação interna da movimentação não sai do servidor', async () => {
    const res = await request(app).get('/api/movimentacoes').set('Authorization', `Bearer ${token}`);
    expect(JSON.stringify(res.body)).not.toContain('anotação interna');
  });

  it('o retorno do PUT tem o mesmo shape da listagem, para o merge do frontend', async () => {
    // O AppContext funde `{...linhaAntiga, ...respostaDoPut}`: shapes diferentes
    // deixariam a mesma lista inconsistente depois de uma edição.
    const lista = await request(app).get('/api/clientes').set('Authorization', `Bearer ${token}`);
    const put = await request(app)
      .put('/api/clientes/cli-teste')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Cliente Renomeado', telefone: '(16) 99999-0000' });

    expect(put.status).toBe(200);
    expect(Object.keys(put.body).sort()).toEqual(Object.keys(lista.body[0]).sort());
  });

  it('a trilha de auditoria continua guardando a linha inteira', async () => {
    // A exceção deliberada à allowlist: o snapshot da exclusão é prova forense.
    const lavagem = await criarLavagem({ valor: 55 });
    await request(app).delete(`/api/lavagens/${lavagem.id}`).set('Authorization', `Bearer ${token}`);

    const trilha = await db.get('SELECT valor_anterior FROM auditoria_lavagens WHERE lavagem_id = ?', [lavagem.id]);
    expect(JSON.parse(trilha.valor_anterior)).toHaveProperty('user_id');
  });
});

describe('Consultas parametrizadas e identificadores em allowlist', () => {
  let token;

  beforeEach(async () => {
    await prepararBanco();
    token = await autenticar('admin');
  });

  it.each([
    ['/api/veiculos'],
    ['/api/lavagens'],
  ])('%s trata o filtro como valor, não como SQL', async (rota) => {
    const res = await request(app)
      .get(rota)
      .query({ cliente_id: "' OR 1=1 --" })
      .set('Authorization', `Bearer ${token}`);

    // Parametrizado: a string inteira é comparada como valor e não casa com nada.
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    // Interpolada, o `--` comentaria o resto e devolveria a tabela toda.
    expect(await db.get('SELECT count(*) c FROM veiculos')).toMatchObject({ c: 1 });
  });

  it('a exclusão em cascata recusa tabela fora da allowlist', async () => {
    await expect(excluirComAuditoria('users; DROP TABLE clientes', 'id', 'x', 'teste', USUARIOS.admin.id))
      .rejects.toThrow(/Tabela não permitida/);
    expect(await db.get('SELECT count(*) c FROM clientes')).toMatchObject({ c: 1 });
  });

  it('a exclusão em cascata recusa coluna fora da allowlist', async () => {
    await expect(excluirComAuditoria('clientes', 'id = id OR 1=1 --', 'x', 'teste', USUARIOS.admin.id))
      .rejects.toThrow(/Coluna não permitida/);
    expect(await db.get('SELECT count(*) c FROM clientes')).toMatchObject({ c: 1 });
  });
});
