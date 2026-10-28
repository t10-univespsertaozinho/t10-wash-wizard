/**
 * Regressão do deploy em produção (Render).
 *
 * O boot do `server.js` importa `config.js`. Quando as senhas de seed eram
 * resolvidas no topo desse módulo, um serviço web em produção não subia sem
 * `SEED_ADMIN_PASSWORD` — mesmo sem o seed rodar. Estes testes rodam em um
 * processo filho com `NODE_ENV=production` para provar que:
 *   1. importar a configuração da API não exige variáveis de seed;
 *   2. o seed continua barrando senhas padrão quando é executado de fato.
 *
 * O processo filho isola o `NODE_ENV` do resto da suíte (que força `test`).
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

const JWT_DE_TESTE = 'segredo_de_producao_com_mais_de_32_caracteres_000';

function rodarNode(script, envExtra = {}) {
  return execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://mock:mock@127.0.0.1:5432/mock',
      // Vazio impede o dotenv de preencher com o backend/.env local: o teste
      // precisa reproduzir um deploy que NÃO definiu o segredo nem as senhas.
      JWT_SECRET: '',
      SEED_ADMIN_PASSWORD: '',
      SEED_OPERADOR_PASSWORD: '',
      ...envExtra,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('configuração de produção (deploy no Render)', () => {
  it('importa config.js sem exigir JWT_SECRET nem as senhas de seed', () => {
    const saida = rodarNode(`
      await import('./config.js');
      console.log('CONFIG_OK');
    `);

    expect(saida).toContain('CONFIG_OK');
  });

  it('valida JWT_SECRET sob demanda, com mensagem clara', () => {
    const saida = rodarNode(`
      const { obterJwtSecret } = await import('./config.js');
      try {
        obterJwtSecret();
        console.log('NAO_FALHOU');
      } catch (err) {
        console.log('ERRO_ESPERADO:' + err.message);
      }
    `);

    expect(saida).toContain('ERRO_ESPERADO');
    expect(saida).toContain('JWT_SECRET');
    expect(saida).not.toContain('NAO_FALHOU');
  });

  it('aceita um JWT_SECRET válido em produção', () => {
    const saida = rodarNode(
      `
        const { obterJwtSecret } = await import('./config.js');
        console.log(obterJwtSecret());
      `,
      { JWT_SECRET: JWT_DE_TESTE }
    );

    expect(saida.trim()).toBe(JWT_DE_TESTE);
  });

  it('mantém a importação de seed-credentials.js livre de efeitos colaterais', () => {
    const saida = rodarNode(`
      await import('./seed-credentials.js');
      console.log('IMPORT_OK');
    `);

    expect(saida).toContain('IMPORT_OK');
  });

  it('o seed barra senha ausente em produção, mas só quando é executado', () => {
    const saida = rodarNode(`
      const { resolverSenhaSeed } = await import('./seed-credentials.js');
      try {
        resolverSenhaSeed('SEED_ADMIN_PASSWORD');
        console.log('NAO_FALHOU');
      } catch (err) {
        console.log('ERRO_ESPERADO:' + err.message);
      }
    `);

    expect(saida).toContain('ERRO_ESPERADO');
    expect(saida).toContain('SEED_ADMIN_PASSWORD');
    expect(saida).not.toContain('NAO_FALHOU');
  });

  it('o seed aceita uma senha própria em produção', () => {
    const saida = rodarNode(
      `
        const { resolverSenhaSeed } = await import('./seed-credentials.js');
        console.log(resolverSenhaSeed('SEED_ADMIN_PASSWORD'));
      `,
      { SEED_ADMIN_PASSWORD: 'senha-forte-de-producao' }
    );

    expect(saida.trim()).toBe('senha-forte-de-producao');
  });
});
