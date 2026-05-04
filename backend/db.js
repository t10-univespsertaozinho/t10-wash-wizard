import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../wash_wizard.db');
const schemaPath = path.resolve(__dirname, 'schema.sql');

// Conexão com o banco de dados
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados SQLite', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
    
    // Habilitar chaves estrangeiras
    db.run('PRAGMA foreign_keys = ON;', (err) => {
      if (err) console.error('Erro ao habilitar foreign keys:', err);
    });

    // Inicializar schema se necessário
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema, (err) => {
      if (err) {
        console.error('Erro ao executar o schema:', err);
      } else {
        console.log('Schema inicializado com sucesso.');
      }
    });
  }
});

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
