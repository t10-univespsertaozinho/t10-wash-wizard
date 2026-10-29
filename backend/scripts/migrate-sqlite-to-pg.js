/** Importa os dados locais SQLite para o schema PostgreSQL do projeto.
 * Uso: npm run db:ingest -- [--source caminho.sqlite] [--apply]
 * Sem --apply, apenas exibe contagens; a escrita é transacional e repetível.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';
import { dbReady, pool } from '../db.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const sourceIndex = args.indexOf('--source');
const sourcePath = path.resolve(backendDir, sourceIndex >= 0 ? args[sourceIndex + 1] : 'database.sqlite');

// Ordem topológica das chaves estrangeiras em backend/schema.postgres.sql.
const tables = [
  { name: 'users', columns: ['id', 'email', 'nome', 'password_hash', 'role', 'created_at'] },
  { name: 'tipos_lavagem', columns: ['id', 'nome', 'descricao', 'preco', 'created_at'] },
  { name: 'clientes', columns: ['id', 'user_id', 'nome', 'telefone', 'data_nascimento', 'created_at'] },
  { name: 'veiculos', columns: ['id', 'cliente_id', 'user_id', 'modelo', 'placa', 'cor', 'marca', 'created_at'] },
  { name: 'produtos', columns: ['id', 'nome', 'quantidade', 'estoque_minimo', 'categoria', 'unidade', 'preco_unitario', 'user_id', 'created_at'] },
  { name: 'lavagens', columns: ['id', 'cliente_id', 'veiculo_id', 'tipo_lavagem_id', 'status', 'valor', 'data', 'user_id', 'pagamento', 'observacao', 'data_conclusao'] },
  { name: 'movimentacoes', columns: ['id', 'produto_id', 'tipo', 'quantidade', 'observacao', 'user_id', 'data'] },
  { name: 'auditoria_lavagens', columns: ['id', 'lavagem_id', 'acao', 'dados_anteriores', 'dados_novos', 'user_id', 'data', 'campo', 'valor_anterior', 'valor_novo'] },
];

const timestamp = (value) => {
  if (value == null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Timestamp SQLite inválido: ${value}`);
  return parsed.toISOString();
};
const sqliteAll = (db, sql) => new Promise((resolve, reject) => db.all(sql, (err, rows) => err ? reject(err) : resolve(rows)));
const closeSqlite = (db) => new Promise((resolve, reject) => db.close((err) => err ? reject(err) : resolve()));

let sqlite;
try {
  if (!fs.existsSync(sourcePath)) throw new Error(`Banco SQLite não encontrado: ${sourcePath}`);
  await dbReady;
  sqlite = await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(sourcePath, sqlite3.OPEN_READONLY, (err) => err ? reject(err) : resolve(db));
  });
  const source = new Map();
  for (const table of tables) {
    const sqliteColumns = new Set((await sqliteAll(sqlite, `PRAGMA table_info(${table.name})`)).map(({ name }) => name));
    const selection = table.columns.map((column) => {
      if (sqliteColumns.has(column)) return column;
      // auditoria_lavagens ganhou estas colunas no schema PG; versões antigas
      // do SQLite guardavam apenas o formato campo/valor anterior/novo.
      if (table.name === 'auditoria_lavagens' && column === 'acao') return "'legacy' AS acao";
      if (table.name === 'auditoria_lavagens' && ['dados_anteriores', 'dados_novos'].includes(column)) return `NULL AS ${column}`;
      // Campo opcional adicionado após a criação de algumas bases locais.
      if (table.name === 'clientes' && column === 'data_nascimento') return 'NULL AS data_nascimento';
      throw new Error(`Coluna obrigatória ausente em SQLite: ${table.name}.${column}`);
    });
    const rows = await sqliteAll(sqlite, `SELECT ${selection.join(', ')} FROM ${table.name} ORDER BY rowid`);
    source.set(table.name, rows.map((row) => {
      for (const column of ['created_at', 'data', 'data_conclusao']) {
        if (column in row) row[column] = timestamp(row[column]);
      }
      return row;
    }));
  }

  const counts = Object.fromEntries([...source].map(([name, rows]) => [name, rows.length]));
  console.log(`Origem SQLite: ${sourcePath}`);
  console.log(`Modo: ${apply ? 'IMPORTAÇÃO' : 'prévia (sem escrita)'}`);
  if (apply) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const table of tables) {
        const placeholders = `(${table.columns.map((_, i) => `$${i + 1}`).join(', ')})`;
        const sql = `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
        let inserted = 0;
        for (const row of source.get(table.name)) {
          const result = await client.query(sql, table.columns.map((column) => row[column] ?? null));
          inserted += result.rowCount;
        }
        console.log(`${table.name}: SQLite=${counts[table.name]}, inseridos=${inserted}`);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  for (const { name } of tables) {
    const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${name}`);
    console.log(`${name}: SQLite=${counts[name]}, PostgreSQL=${result.rows[0].count}`);
  }
  if (!apply) console.log('Revise as contagens e use --apply para importar.');
  if (apply) console.log('IDs são TEXT gerados pela aplicação; não há sequências numéricas.');
} catch (error) {
  console.error('Falha na ingestão:', error.message);
  process.exitCode = 1;
} finally {
  if (sqlite) await closeSqlite(sqlite);
  await pool.end();
}
