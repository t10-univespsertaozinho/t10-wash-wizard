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
