import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

// Valor publicado em .env.example — nunca deve chegar a produção.
const SEGREDO_DE_EXEMPLO = 'troque_por_um_segredo_aleatorio_longo';
const TAMANHO_MINIMO_SEGREDO = 32;

// Em produção o segredo é obrigatório e a falha é fatal: subir com um segredo
// efêmero faria cada processo do cluster assinar com uma chave diferente,
// tornando as sessões aleatoriamente inválidas — um incidente difícil de
// diagnosticar. É melhor não iniciar do que iniciar quebrado.
export const JWT_SECRET = (() => {
  const doAmbiente = process.env.JWT_SECRET;

  const valido = typeof doAmbiente === 'string'
    && doAmbiente.length >= TAMANHO_MINIMO_SEGREDO
    && doAmbiente !== SEGREDO_DE_EXEMPLO;

  if (valido) return doAmbiente;

  if (isProd) {
    const motivo = !doAmbiente
      ? 'não definido'
      : doAmbiente === SEGREDO_DE_EXEMPLO
        ? 'igual ao valor de exemplo do .env.example'
        : `muito curto (${doAmbiente.length} caracteres; mínimo ${TAMANHO_MINIMO_SEGREDO})`;

    throw new Error(
      `JWT_SECRET ${motivo}. Defina um segredo aleatório de ao menos ` +
      `${TAMANHO_MINIMO_SEGREDO} caracteres em backend/.env antes de iniciar em produção. ` +
      "Gere um com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  console.warn(
    'AVISO (desenvolvimento): JWT_SECRET ausente, curto ou igual ao valor de exemplo. ' +
    'Gerando um segredo temporário para esta execução — todas as sessões serão ' +
    'invalidadas ao reiniciar o servidor. Defina JWT_SECRET em backend/.env.'
  );
  return crypto.randomBytes(32).toString('hex');
})();

export const JWT_EXPIRES_IN = '8h';
export const JWT_ALGORITHM = 'HS256';

// ==========================================
// SENHAS DE BOOTSTRAP (FA-17)
// ==========================================
// As senhas padrão estão no README e no .env.example, ou seja, são públicas.
// Uma instalação que nunca configurou o .env fica com credenciais de admin
// conhecidas por qualquer pessoa — e nada no boot avisava sobre isso.
const SENHAS_SEED_PADRAO = {
  SEED_ADMIN_PASSWORD: 'admin123',
  SEED_OPERADOR_PASSWORD: 'operador123',
};

function resolverSenhaSeed(variavel) {
  const padrao = SENHAS_SEED_PADRAO[variavel];
  const doAmbiente = process.env[variavel];

  if (doAmbiente && doAmbiente !== padrao) return doAmbiente;

  // Em produção é fatal pelo mesmo critério do JWT_SECRET: é melhor não subir
  // do que subir com uma senha de administrador publicada na documentação.
  if (isProd) {
    throw new Error(
      `${variavel} ${doAmbiente ? 'ainda é a senha padrão da documentação' : 'não está definida'}. ` +
      `Defina uma senha própria em backend/.env antes de iniciar em produção.`
    );
  }

  return padrao;
}

export const SEED_ADMIN_PASSWORD = resolverSenhaSeed('SEED_ADMIN_PASSWORD');
export const SEED_OPERADOR_PASSWORD = resolverSenhaSeed('SEED_OPERADOR_PASSWORD');

// O aviso sai no boot do servidor e no seed, uma vez por processo, listando
// exatamente quais credenciais continuam públicas.
export function avisarSenhasSeedPadrao() {
  const padrao = Object.entries(SENHAS_SEED_PADRAO)
    .filter(([variavel, valor]) => (process.env[variavel] || valor) === valor)
    .map(([variavel]) => variavel);

  if (padrao.length === 0 || isProd) return;

  console.warn(
    `AVISO (desenvolvimento): ${padrao.join(' e ')} ainda usa(m) a senha padrão da ` +
    'documentação (admin123/operador123). Qualquer pessoa com acesso à rede pode ' +
    'entrar como administrador. Defina senhas próprias em backend/.env e rode ' +
    '`npm run seed` novamente antes de usar o sistema em campo.'
  );
}
