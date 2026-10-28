/**
 * Lançador da suíte (`npm test`).
 *
 * Mantém UV_THREADPOOL_SIZE folgado porque bcrypt (hash de senha no seed e no
 * login) e as conexões do PostgreSQL disputam a mesma threadpool do libuv. Um
 * launcher garante que a variável exista ANTES de o processo dimensionar a
 * threadpool, sem depender da sintaxe de variáveis de ambiente do shell.
 *
 * Os testes exigem TEST_DATABASE_URL (ver test/helpers.js); sem ela a suíte
 * aborta com uma mensagem explicando como configurar um PostgreSQL descartável.
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

// Repassa sinais ao vitest: sem isso, um Ctrl+C (ou o timeout do CI) mata só o
// launcher e deixa o fork e suas conexões com o PostgreSQL de teste vivos,
// segurando locks que travam a execução seguinte.
for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => filho.kill(sinal));
}
