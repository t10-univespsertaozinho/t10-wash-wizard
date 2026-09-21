import crypto from 'crypto';

export const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn(
    'AVISO: JWT_SECRET não definido no .env. Gerando um segredo temporário para esta execução ' +
    '(todas as sessões serão invalidadas ao reiniciar o servidor). Defina JWT_SECRET em backend/.env para produção.'
  );
  return crypto.randomBytes(32).toString('hex');
})();

export const JWT_EXPIRES_IN = '8h';
