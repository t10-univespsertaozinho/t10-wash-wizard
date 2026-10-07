import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],

    // Cada arquivo roda em um fork isolado e sequencial: ganha o seu próprio
    // banco temporário e a sua própria conexão sqlite3 (ver test/helpers.js).
    // Compartilhar uma conexão entre arquivos deixava a suíte intermitente —
    // o estado transacional de um arquivo vazava para o beforeEach do seguinte.
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,

    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
