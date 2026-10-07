/**
 * Infraestrutura dos testes de integração.
 *
 * O objetivo é exercitar o app Express real (rotas, middlewares, SQL) e não uma
 * imitação: as regras que a auditoria cobrou — RBAC, posse de `data_conclusao`,
 * trilha de auditoria, validação do CSV — vivem justamente na costura entre
 * middleware, handler e banco, que um mock de `db.js` não testaria.
 *
 * Isolamento: `DB_PATH` aponta para um arquivo temporário por execução e
 * `NODE_ENV=test` impede o `app.listen`.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const dbFile = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'wash-wizard-test-')),
  'teste.db'
);

process.env.NODE_ENV = 'test';
process.env.DB_PATH = dbFile;
// Segredo fixo e longo: sem ele o config.js gera um aleatório por execução e
// avisa no console, poluindo a saída dos testes.
process.env.JWT_SECRET = 'segredo_de_teste_com_mais_de_32_caracteres_000';
process.env.SEED_ADMIN_PASSWORD = 'senha-de-teste-admin';
process.env.SEED_OPERADOR_PASSWORD = 'senha-de-teste-operador';

const [{ default: request }, { app }, db, { default: bcrypt }] = await Promise.all([
  import('supertest'),
  import('../server.js'),
  import('../db.js'),
  import('bcryptjs'),
]);

await db.dbReady;

export { request, app, db, dbFile };

export const USUARIOS = {
  admin: { id: 'test-admin', email: 'admin@teste.local', nome: 'Admin', role: 'admin', senha: 'senha-admin-teste' },
  operador: { id: 'test-operador', email: 'operador@teste.local', nome: 'Operador', role: 'operador', senha: 'senha-operador-teste' },
};

/**
 * Script de reset do cenário, montado uma única vez.
 *
 * É um `exec` só, de propósito: emitir uma dezena de DELETE/INSERT avulsos por
 * teste multiplicava as transações implícitas sobre a mesma conexão sqlite3 e a
 * suíte ficava intermitente — um hook esbarrava no lock do anterior e estourava
 * o timeout. Um batch único é uma transação e um round-trip.
 *
 * A ordem respeita as FKs (filhos antes dos pais), então não é preciso desligar
 * `foreign_keys` — o que também mantém o teste fiel ao modo como o servidor roda.
 */
const SCRIPT_RESET = (() => {
  const agora = new Date().toISOString();
  // Custo 4: suficiente para o bcrypt.compare do login e barato o bastante para
  // rodar em todo beforeEach.
  const hash = (senha) => bcrypt.hashSync(senha, 4);
  const sql = (v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

  const usuarios = Object.values(USUARIOS)
    .map(u => `INSERT INTO users (id, email, nome, role, password_hash, created_at) VALUES (${[u.id, u.email, u.nome, u.role, hash(u.senha), agora].map(sql).join(', ')});`)
    .join('\n');

  return `
    BEGIN IMMEDIATE TRANSACTION;
    DELETE FROM auditoria_lavagens;
    DELETE FROM movimentacoes;
    DELETE FROM lavagens;
    DELETE FROM veiculos;
    DELETE FROM clientes;
    DELETE FROM produtos;
    DELETE FROM tipos_lavagem;
    DELETE FROM users;
    ${usuarios}
    INSERT INTO clientes (id, user_id, nome, telefone, created_at)
      VALUES ('cli-teste', ${sql(USUARIOS.admin.id)}, 'Cliente de Teste', '(16) 99999-0000', ${sql(agora)});
    INSERT INTO veiculos (id, cliente_id, user_id, modelo, placa, cor, marca, created_at)
      VALUES ('vei-teste', 'cli-teste', ${sql(USUARIOS.admin.id)}, 'Gol', 'ABC1D23', 'Prata', 'VW', ${sql(agora)});
    INSERT INTO tipos_lavagem (id, nome, descricao, preco, created_at)
      VALUES ('tl-teste', 'Lavagem Simples', 'Externa', 25, ${sql(agora)});
    COMMIT;
  `;
})();

/** Zera o banco e recria o cenário base. Chamado no beforeEach de cada suíte. */
export async function prepararBanco() {
  try {
    await db.exec(SCRIPT_RESET);
  } catch (err) {
    // Se o COMMIT não aconteceu, a transação fica aberta e contamina o próximo
    // teste: desfaz antes de propagar o erro real.
    await db.exec('ROLLBACK;').catch(() => {});
    throw err;
  }
}

/**
 * Apaga tabelas específicas do cenário base. O import de backup apaga só as
 * tabelas presentes no envio, então importar `clientes.csv` deixaria o veículo
 * do cenário órfão e o `foreign_key_check` do fim do fluxo rejeitaria o backup
 * inteiro — comportamento correto do servidor, mas que precisa ser preparado
 * nos testes que importam uma tabela isolada.
 */
export async function limparTabelas(...nomes) {
  for (const nome of nomes) {
    await db.exec(`DELETE FROM ${nome};`);
  }
}

/** Faz login de verdade: o token sai do mesmo fluxo que o frontend usa. */
export async function autenticar(perfil) {
  const { email, senha } = USUARIOS[perfil];
  const res = await request(app).post('/api/auth/login').send({ email, senha });
  if (res.status !== 200) throw new Error(`Login de ${perfil} falhou: ${res.status} ${res.text}`);
  return res.body.token;
}

/** Cria uma lavagem direto no banco, sem passar pelas regras da API. */
export async function criarLavagem(campos = {}) {
  const lavagem = {
    id: `lav-${crypto.randomUUID().slice(0, 8)}`,
    cliente_id: 'cli-teste',
    veiculo_id: 'vei-teste',
    tipo_lavagem_id: 'tl-teste',
    status: 'pendente',
    valor: 80,
    data: new Date().toISOString(),
    user_id: USUARIOS.admin.id,
    pagamento: 'Pendente',
    observacao: '',
    data_conclusao: null,
    ...campos,
  };
  await db.run(
    `INSERT INTO lavagens (id, cliente_id, veiculo_id, tipo_lavagem_id, status, valor, data, user_id, pagamento, observacao, data_conclusao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [lavagem.id, lavagem.cliente_id, lavagem.veiculo_id, lavagem.tipo_lavagem_id, lavagem.status,
     lavagem.valor, lavagem.data, lavagem.user_id, lavagem.pagamento, lavagem.observacao, lavagem.data_conclusao]
  );
  return lavagem;
}
