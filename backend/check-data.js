import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'wash_wizard.db');

const db = new sqlite3.Database(DB_PATH);

db.all('SELECT COUNT(*) as total FROM clientes', (err, rows) => {
  console.log('Clientes:', rows[0].total);
});
db.all('SELECT COUNT(*) as total FROM veiculos', (err, rows) => {
  console.log('Veículos:', rows[0].total);
});
db.all('SELECT COUNT(*) as total FROM lavagens', (err, rows) => {
  console.log('Lavagens:', rows[0].total);
});
db.all('SELECT COUNT(*) as total FROM produtos', (err, rows) => {
  console.log('Produtos:', rows[0].total);
});
db.all('SELECT COUNT(*) as total FROM tipos_lavagem', (err, rows) => {
  console.log('Tipos de Lavagem:', rows[0].total);
});

setTimeout(() => db.close(), 1000);