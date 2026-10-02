/**
 * Utilitários de segurança do frontend.
 *
 * Nota de arquitetura: estas funções existem para UX (feedback imediato no
 * formulário), não como controle de segurança. A autoridade final é o backend,
 * que revalida formato, obrigatoriedade e faixa de todos os campos antes de
 * gravar — ver "Validação de Entrada" em SECURITY.md.
 *
 * Não há função de escape de HTML aqui de propósito: o React já escapa todo
 * conteúdo interpolado em JSX, e escapar antes de gravar causaria
 * double-encoding (o usuário veria `João &#x27;Zé&#x27;` na tela).
 */

export const TOKEN_STORAGE_KEY = 't10_token';

/** Mesmo critério do backend (RE_EMAIL em backend/server.js). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Telefone é armazenado formatado; a validação é pela contagem de dígitos. */
export function isValidPhone(phone: string): boolean {
  const digitos = phone.replace(/\D/g, '');
  return digitos.length >= 10 && digitos.length <= 11;
}

/** Formatos aceitos pelo backend: antigo AAA1234, Mercosul AAA1A23. */
export function isValidPlaca(placa: string): boolean {
  const limpa = placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^([A-Z]{3}\d{4}|[A-Z]{3}\d[A-Z]\d{2}|[A-Z]{4}\d[A-Z]{2}\d{2})$/.test(limpa);
}

/** Mínimo exigido pelo backend em POST /api/users. */
export const SENHA_MINIMA = 10;
