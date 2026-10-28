import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],

    // Cada arquivo roda em um fork isolado e sequencial. Todos compartilham o
    // mesmo PostgreSQL de teste (TEST_DATABASE_URL), mas o TRUNCATE do
    // beforeEach garante que o estado de um arquivo não vaze para o seguinte.
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,

    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
