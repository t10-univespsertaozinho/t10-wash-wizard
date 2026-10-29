/**
 * Infraestrutura dos testes de integração.
 *
 * O objetivo é exercitar o app Express real (rotas, middlewares, SQL) e não uma
 * imitação: as regras que a auditoria cobrou — RBAC, posse de `data_conclusao`,
 * trilha de auditoria, validação do CSV — vivem justamente na costura entre
 * middleware, handler e banco, que um mock de `db.js` não testaria.
 *
 * Isolamento: os testes usam obrigatoriamente `TEST_DATABASE_URL`, um banco
 * PostgreSQL descartável — nunca o `DATABASE_URL` do Supabase. Antes de cada
 * teste as tabelas são truncadas e o cenário base é recriado.
 * `NODE_ENV=test` impede o `app.listen`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { afterAll } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// O TEST_DATABASE_URL costuma morar no backend/.env (que é gitignored).
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

process.env.NODE_ENV = 'test';
// Segredo fixo e longo: sem ele o config.js gera um aleatório por execução e
// avisa no console, poluindo a saída dos testes.
process.env.JWT_SECRET = 'segredo_de_teste_com_mais_de_32_caracteres_000';
process.env.SEED_ADMIN_PASSWORD = 'senha-de-teste-admin';
process.env.SEED_OPERADOR_PASSWORD = 'senha-de-teste-operador';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL não definida. Os testes de integração precisam de um ' +
    'PostgreSQL descartável. Ex.: postgresql://postgres@127.0.0.1:5432/wash_wizard_test'
  );
}

// Guarda-corpo: um TEST_DATABASE_URL apontando para produção transformaria
// cada `prepararBanco()` em um TRUNCATE da base real.
const hostTeste = new URL(testDatabaseUrl).hostname;
if (/supabase\.(co|com|net)$/i.test(hostTeste) || hostTeste.includes('pooler.supabase')) {
  throw new Error(
    `Recusando rodar os testes contra "${hostTeste}": TEST_DATABASE_URL aponta ` +
    'para um host Supabase. Use um PostgreSQL local descartável.'
  );
}
if (process.env.DATABASE_URL === testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL é igual ao DATABASE_URL de desenvolvimento. Use um banco separado.');
}

// db.js lê DATABASE_URL no import: sobrescrever antes do import dinâmico é o
// que garante que a suíte nunca toque no banco de desenvolvimento.
process.env.DATABASE_URL = testDatabaseUrl;

const [{ default: request }, { app }, db, { default: bcrypt }] = await Promise.all([
  import('supertest'),
  import('../server.js'),
  import('../db.js'),
  import('bcryptjs'),
]);

await db.dbReady;

// Schema idempotente: cria as tabelas que faltam no banco de teste. É o mesmo
// arquivo usado para provisionar um PostgreSQL local (`npm run db:schema`).
const schemaSql = fs.readFileSync(path.resolve(__dirname, '..', 'schema.postgres.sql'), 'utf8');
await db.exec(schemaSql);
const migrationPagamentoSql = fs.readFileSync(path.resolve(__dirname, '..', 'migrations', '002_pagamento_obrigatorio_conclusao.sql'), 'utf8');
await db.exec(migrationPagamentoSql);

export { request, app, db, testDatabaseUrl as dbUrl };

// Encerra o pool ao fim de cada arquivo de teste. Sem isso o processo do fork
// fica com conexões ociosas abertas e o vitest não finaliza sozinho — e, pior,
// uma execução interrompida deixa locks pendurados no PostgreSQL de teste.
afterAll(async () => {
  await db.pool.end();
});

export const USUARIOS = {
  admin: { id: 'test-admin', email: 'admin@teste.local', nome: 'Admin', role: 'admin', senha: 'senha-admin-teste' },
  operador: { id: 'test-operador', email: 'operador@teste.local', nome: 'Operador', role: 'operador', senha: 'senha-operador-teste' },
};

/**
 * Script de reset do cenário, montado uma única vez.
 *
 * Um único `exec`, de propósito: os DELETEs + INSERTs em um comando são uma
 * transação implícita e um round-trip, em vez de dezenas de queries por teste.
 * A ordem respeita as FKs (filhos antes dos pais), então não é preciso desligar
 * constraints — o que também mantém o teste fiel ao modo como o servidor roda.
 *
 * DELETE em vez de TRUNCATE: o TRUNCATE trunca os arquivos físicos das relações
 * e força fsync por tabela; em disco lento/overlay isso levava 10-20s por
 * beforeEach e estourava o hookTimeout. Nas tabelas pequenas do cenário, DELETE
 * é instantâneo.
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
  `;
})();

/** Zera o banco e recria o cenário base. Chamado no beforeEach de cada suíte. */
export async function prepararBanco() {
  await db.exec(SCRIPT_RESET);
}

/**
 * Apaga tabelas específicas do cenário base. O import de backup apaga só as
 * tabelas presentes no envio, então importar `clientes.csv` deixaria o veículo
 * do cenário órfão e a FK rejeitaria o backup inteiro — comportamento correto
 * do servidor, mas que precisa ser preparado nos testes que importam uma tabela
 * isolada.
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
    pagamento: campos.status === 'concluida' ? 'Dinheiro' : 'Pendente',
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
