/**
 * Aplica um arquivo .sql no banco apontado por DATABASE_URL.
 *
 * Usado por `npm run db:schema` (schema.postgres.sql) e por `npm run db:migrate`
 * (todos os arquivos de migrations/, em ordem). O `pg` executa múltiplos
 * statements quando a query não tem parâmetros.
 *
 * Uso:
 *   node scripts/aplicar-sql.js schema.postgres.sql
 *   node scripts/aplicar-sql.js migrations/*.sql
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbReady, exec, pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raizBackend = path.resolve(__dirname, '..');

const arquivos = process.argv.slice(2);
if (arquivos.length === 0) {
  console.error('Uso: node scripts/aplicar-sql.js <arquivo.sql> [...]');
  process.exit(1);
}

try {
  await dbReady;
  for (const arquivo of arquivos) {
    const caminho = path.resolve(raizBackend, arquivo);
    console.log(`Aplicando ${path.relative(raizBackend, caminho)}...`);
    await exec(fs.readFileSync(caminho, 'utf8'));
  }
  console.log('Concluído.');
} catch (err) {
  console.error('Falha ao aplicar SQL:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
