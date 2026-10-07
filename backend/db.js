import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB_PATH permite apontar para um arquivo descartável — é o que a suíte de
// testes de integração usa para não encostar no banco de desenvolvimento.
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '../wash_wizard.db');
const schemaPath = path.resolve(__dirname, 'schema.sql');

const dbExists = fs.existsSync(dbPath);

// dbReady só resolve depois que pragmas + schema terminarem de rodar de fato.
// O servidor precisa esperar isso: sem a espera, o app.listen subia no meio da
// aplicação do schema e uma requisição chegava com "no such table" (ex: INSERT
// em auditoria_lavagens logo após o boot de um banco legado).
let aoAbrir;
let aoFalhar;
export const dbReady = new Promise((resolve, reject) => {
  aoAbrir = resolve;
  aoFalhar = reject;
});

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados SQLite', err.message);
    aoFalhar(err);
    return;
  }
  console.log('Conectado ao banco de dados SQLite.');
  prepararBanco();
});

async function prepararBanco() {
  try {
    // WAL: leitores não bloqueiam mais o escritor e vice-versa — era o modo
    // 'delete' antes, o que travava quem consultasse o banco fora do processo.
    // journal_mode = WAL é persistido no próprio arquivo, sobrevive a restarts.
    await exec('PRAGMA journal_mode = WAL;');
    // Em vez de falhar na hora com SQLITE_BUSY, o driver espera até 5s pela
    // liberação do lock (importante para ferramentas externas de backup).
    await exec('PRAGMA busy_timeout = 5000;');
    await exec('PRAGMA foreign_keys = ON;');

    // O schema é inteiramente idempotente (CREATE TABLE/INDEX IF NOT EXISTS),
    // então é aplicado em toda inicialização. Isso faz dele também a migração:
    // tabelas novas (ex: auditoria_lavagens) passam a existir em bancos antigos
    // sem precisar recriar o arquivo nem perder dados.
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await exec(schema);

    await migrarAuditoriaSemCascade();

    console.log(dbExists
      ? 'Schema verificado (banco existente, estruturas novas aplicadas).'
      : 'Schema inicializado com sucesso.');
    console.log(`SQLite journal_mode = ${(await get('PRAGMA journal_mode;')).journal_mode}`);
    aoAbrir();
  } catch (err) {
    console.error('Erro ao preparar o banco de dados:', err.message);
    aoFalhar(err);
  }
}

// CREATE TABLE IF NOT EXISTS não altera uma tabela que já existe, então bancos
// criados antes desta correção continuariam com o ON DELETE CASCADE em
// auditoria_lavagens — e perderiam a trilha justamente ao excluir uma lavagem.
// Esta migração recria a tabela sem a FK, preservando as linhas existentes.
// É idempotente: só roda quando o DDL atual ainda tem o cascade.
async function migrarAuditoriaSemCascade() {
  const tabela = await get(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'auditoria_lavagens'"
  );
  if (!tabela?.sql || !/REFERENCES\s+lavagens/i.test(tabela.sql)) return;

  // O PRAGMA só tem efeito fora de transação, por isso vem antes do BEGIN.
  await exec('PRAGMA foreign_keys = OFF;');
  try {
    await exec(`
      BEGIN TRANSACTION;
      CREATE TABLE auditoria_lavagens_nova (
        id TEXT PRIMARY KEY,
        lavagem_id TEXT NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        campo TEXT NOT NULL,
        valor_anterior TEXT,
        valor_novo TEXT,
        data TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      INSERT INTO auditoria_lavagens_nova (id, lavagem_id, user_id, campo, valor_anterior, valor_novo, data)
        SELECT id, lavagem_id, user_id, campo, valor_anterior, valor_novo, data FROM auditoria_lavagens;
      DROP TABLE auditoria_lavagens;
      ALTER TABLE auditoria_lavagens_nova RENAME TO auditoria_lavagens;
      CREATE INDEX IF NOT EXISTS idx_auditoria_lavagens_lavagem_id ON auditoria_lavagens(lavagem_id);
      CREATE INDEX IF NOT EXISTS idx_auditoria_lavagens_user_id ON auditoria_lavagens(user_id);
      COMMIT;
    `);
    console.log('Migração aplicada: auditoria_lavagens agora preserva o histórico de exclusões.');
  } catch (err) {
    await exec('ROLLBACK;').catch(() => {});
    throw err;
  } finally {
    await exec('PRAGMA foreign_keys = ON;').catch(() => {});
  }
}

// Wrapper para Promessas para facilitar o CRUD no Express
export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

export const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const exec = (sql) => {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export default db;
