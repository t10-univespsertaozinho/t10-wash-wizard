/**
 * Lançador da suíte (`npm test`).
 *
 * Existe por um motivo só: UV_THREADPOOL_SIZE precisa estar no ambiente ANTES do
 * processo começar a usar a threadpool do libuv. O driver sqlite3 despacha cada
 * statement nela, e os 4 slots padrão são os mesmos disputados pelo bcrypt e
 * pelas requisições do supertest — com a suíte cheia os statements ficavam na
 * fila atrás do resto e os hooks estouravam o timeout de forma intermitente
 * (~30s e falha). Com a fila folgada a suíte roda em ~3s, estável.
 *
 * Definir o valor em `test.env` do vitest.config.js não resolve: lá ele chega
 * depois de a threadpool já ter sido dimensionada. Um launcher mantém isso
 * portátil, sem depender da sintaxe de variáveis de ambiente do shell.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const backendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vitest = path.join(backendDir, 'node_modules', 'vitest', 'vitest.mjs');

const filho = spawn(process.execPath, [vitest, ...process.argv.slice(2)], {
  cwd: backendDir,
  stdio: 'inherit',
  env: { ...process.env, UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE || '32' },
});

filho.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 1));
