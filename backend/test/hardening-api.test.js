/**
 * Regressão do hardening da API: schema estrito (Zod), limite de corpo e
 * cabeçalhos defensivos.
 *
 * O que estes casos protegem é a borda: o handler já validava campo a campo,
 * mas ninguém olhava o corpo inteiro — então propriedade não declarada entrava
 * e string gigante em campo opcional era truncada em silêncio, em vez de
 * recusada. Rate limiting fica em `rate-limit.test.js`, em processo próprio,
 * porque esgotar cota contamina os outros casos do mesmo arquivo.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { request, app, db, prepararBanco, autenticar, criarLavagem, USUARIOS } from './helpers.js';

const corpoCliente = (extra = {}) => ({ nome: 'Maria Silva', telefone: '(16) 99999-0001', ...extra });

describe('Limite de corpo do parser JSON', () => {
  let token;

  beforeEach(async () => {
    await prepararBanco();
    token = await autenticar('admin');
  });

  it('recusa com 413 um corpo acima de 50kb', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'A'.repeat(60 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Corpo da requisição muito grande.');
    expect(await db.get('SELECT count(*) c FROM clientes')).toMatchObject({ c: 1 });
  });

  it('aceita um corpo normal, folgado dentro do limite', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send(corpoCliente());

    expect(res.status).toBe(200);
  });

  it('recusa JSON malformado com 400, sem vazar o corpo enviado', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send('{"nome": "Maria", ');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('JSON inválido no corpo da requisição.');
    expect(JSON.stringify(res.body)).not.toContain('Maria');
  });
});

describe('Cabeçalhos defensivos (helmet)', () => {
  beforeEach(prepararBanco);

  it('emite nosniff e nega enquadramento em iframe', async () => {
    const res = await request(app).get('/api/clientes');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('não anuncia a tecnologia do servidor', async () => {
    const res = await request(app).get('/api/clientes');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Schema estrito — formato da resposta de erro', () => {
  let token;

  beforeEach(async () => {
    await prepararBanco();
    token = await autenticar('admin');
  });

  it('responde 400 com error e detalhes por campo', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
    expect(Array.isArray(res.body.detalhes)).toBe(true);
    expect(res.body.detalhes[0]).toHaveProperty('campo');
    expect(res.body.detalhes[0]).toHaveProperty('mensagem');
    expect(res.body.detalhes.map((d) => d.campo)).toContain('nome');
  });

  it('não ecoa o valor recebido na mensagem de erro', async () => {
    // Um `detalhes` com o conteúdo do campo devolveria dado pessoal ao cliente
    // e o levaria para o log de quem registra respostas 4xx.
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'X', telefone: 'telefone-secreto-do-titular' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('telefone-secreto-do-titular');
  });
});

describe('Schema estrito — clientes', () => {
  let token;

  beforeEach(async () => {
    await prepararBanco();
    token = await autenticar('admin');
  });

  const postCliente = (corpo) =>
    request(app).post('/api/clientes').set('Authorization', `Bearer ${token}`).send(corpo);

  it('recusa nome ausente', async () => {
    expect((await postCliente({ telefone: '(16) 99999-0001' })).status).toBe(400);
  });

  it('recusa nome com menos de 2 caracteres', async () => {
    expect((await postCliente(corpoCliente({ nome: 'A' }))).status).toBe(400);
  });

  it('recusa nome acima de 120 caracteres em vez de truncar', async () => {
    const res = await postCliente(corpoCliente({ nome: 'A'.repeat(500) }));

    expect(res.status).toBe(400);
    // Truncar aceitaria o payload abusivo como válido.
    expect(await db.get('SELECT count(*) c FROM clientes')).toMatchObject({ c: 1 });
  });

  it('recusa tipo errado no nome', async () => {
    expect((await postCliente({ nome: { $ne: null } })).status).toBe(400);
    expect((await postCliente({ nome: 12345 })).status).toBe(400);
  });

  it('recusa telefone fora do padrão brasileiro', async () => {
    expect((await postCliente(corpoCliente({ telefone: '123' }))).status).toBe(400);
  });

  it('aceita telefone com e sem máscara', async () => {
    expect((await postCliente(corpoCliente({ telefone: '(16) 99999-0001' }))).status).toBe(200);
    expect((await postCliente(corpoCliente({ telefone: '16999990002' }))).status).toBe(200);
  });

  it('aceita campo opcional vazio como não informado', async () => {
    const res = await postCliente({ nome: 'Maria Silva', telefone: '', data_nascimento: '' });

    expect(res.status).toBe(200);
    expect(res.body.telefone).toBeNull();
    expect(res.body.data_nascimento).toBeNull();
  });

  it('recusa data de nascimento inexistente no calendário', async () => {
    expect((await postCliente(corpoCliente({ data_nascimento: '2026-02-31' }))).status).toBe(400);
    expect((await postCliente(corpoCliente({ data_nascimento: '31/12/1990' }))).status).toBe(400);
  });

  it('descarta propriedade não declarada no corpo', async () => {
    // O frontend envia `user_id` em todo POST; com `.strict()` a API passaria a
    // recusar cada cadastro. O Zod descarta, e a gravação segue usando o id do
    // token — então um user_id forjado no corpo não tem efeito.
    const res = await postCliente(corpoCliente({ user_id: USUARIOS.operador.id, role: 'admin' }));

    expect(res.status).toBe(200);
    const gravado = await db.get('SELECT user_id FROM clientes WHERE id = ?', [res.body.id]);
    expect(gravado.user_id).toBe(USUARIOS.admin.id);
  });
});

describe('Schema estrito — veículos', () => {
  let token;

  beforeEach(async () => {
    await prepararBanco();
    token = await autenticar('admin');
  });

  const postVeiculo = (corpo) =>
    request(app).post('/api/veiculos').set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: 'cli-teste', modelo: 'Gol', placa: 'ABC1D23', ...corpo });

  it('normaliza a placa com máscara para o formato gravado', async () => {
    const res = await postVeiculo({ placa: 'abc-1d24' });

    expect(res.status).toBe(200);
    expect(res.body.placa).toBe('ABC1D24');
  });

  it.each([['ABC1234'], ['ABC1D23'], ['ABCD1AB23']])('aceita o formato %s', async (placa) => {
    expect((await postVeiculo({ placa })).status).toBe(200);
  });

  it.each([['XX'], ['1234567'], ['ABC12345678901']])('recusa a placa inválida %s', async (placa) => {
    expect((await postVeiculo({ placa })).status).toBe(400);
  });

  it('recusa modelo acima de 60 caracteres', async () => {
    expect((await postVeiculo({ modelo: 'M'.repeat(200) })).status).toBe(400);
  });

  it('recusa cliente ausente', async () => {
    const res = await request(app).post('/api/veiculos').set('Authorization', `Bearer ${token}`)
      .send({ modelo: 'Gol', placa: 'ABC1D25' });

    expect(res.status).toBe(400);
  });
});

describe('Schema estrito — lavagens', () => {
  let tokenAdmin;

  beforeEach(async () => {
    await prepararBanco();
    tokenAdmin = await autenticar('admin');
  });

  const postLavagem = (corpo) =>
    request(app).post('/api/lavagens').set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ cliente_id: 'cli-teste', veiculo_id: 'vei-teste', tipo_lavagem_id: 'tl-teste', valor: 25, ...corpo });

  it.each([['PIX'], ['Débito'], ['Crédito'], ['Dinheiro']])('aceita a forma de pagamento %s que a UI oferece', async (pagamento) => {
    expect((await postLavagem({ pagamento })).status).toBe(200);
  });

  it.each([['cartao_credito'], ['boleto'], ['PIIX']])('recusa a forma de pagamento %s fora do enum', async (pagamento) => {
    const res = await postLavagem({ pagamento });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });

  it('recusa valor negativo e valor não numérico', async () => {
    expect((await postLavagem({ valor: -10 })).status).toBe(400);
    expect((await postLavagem({ valor: 'muito caro' })).status).toBe(400);
  });

  it('aceita valor numérico enviado como string pelo formulário', async () => {
    const res = await postLavagem({ valor: '42.50' });

    expect(res.status).toBe(200);
    expect(res.body.valor).toBe(42.5);
  });

  it('recusa id de relacionamento ausente', async () => {
    const res = await request(app).post('/api/lavagens').set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ cliente_id: 'cli-teste', valor: 25 });

    expect(res.status).toBe(400);
    expect(res.body.detalhes.map((d) => d.campo)).toEqual(expect.arrayContaining(['veiculo_id', 'tipo_lavagem_id']));
  });

  it('recusa observação acima de 500 caracteres', async () => {
    expect((await postLavagem({ observacao: 'o'.repeat(2000) })).status).toBe(400);
  });

  it('mantém a mensagem própria do handler para status fora do domínio', async () => {
    // `status` fica fora do schema de propósito: a mensagem específica é
    // contrato coberto por integridade-lavagens.test.js.
    const res = await postLavagem({ status: 'arquivada' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Status inválido/);
  });

  it('mantém a regra de pagamento obrigatório na conclusão', async () => {
    const res = await postLavagem({ status: 'concluida', pagamento: 'Pendente' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/forma de pagamento/);
  });

  it('permite atualização parcial sem exigir o corpo inteiro', async () => {
    const lavagem = await criarLavagem({ status: 'pendente' });

    const res = await request(app).put(`/api/lavagens/${lavagem.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ observacao: 'Cliente aguardando' });

    expect(res.status).toBe(200);
    expect(res.body.observacao).toBe('Cliente aguardando');
  });
});

describe('Schema estrito — login', () => {
  beforeEach(prepararBanco);

  it('recusa corpo sem credencial com 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });

  it('responde 401, não 400, para e-mail malformado', async () => {
    // Contrato preservado (o teste de boot do CI espera 401) e menos oráculo:
    // 400 para e-mail malformado e 401 para senha errada distinguiria os casos.
    const res = await request(app).post('/api/auth/login').send({ email: 'x', senha: 'y' });

    expect(res.status).toBe(401);
  });

  it('recusa senha absurdamente longa antes do bcrypt', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: USUARIOS.admin.email, senha: 's'.repeat(5000) });

    expect(res.status).toBe(400);
  });
});
