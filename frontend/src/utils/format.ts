/**
 * Formatação defensiva para a camada de apresentação.
 *
 * Motivo (FA-14, FA-15): a UI chamava `valor.toFixed(2)` e
 * `new Date(data).toLocaleDateString('pt-BR')` direto no JSX. O schema tem
 * `NOT NULL` nessas colunas, então hoje é implausível — mas um CSV importado à
 * mão, um UPDATE manual no SQLite ou um endpoint novo que esqueça um campo
 * derrubam a tela inteira: `toFixed` de `undefined` é TypeError (tela branca) e
 * `new Date(null)` imprime "Invalid Date" no meio do histórico do cliente.
 *
 * A regra aqui é uma só: dado ausente ou inválido vira um traço visível, nunca
 * uma exceção e nunca um texto sem sentido.
 */

/** O que aparece quando não há valor exibível. */
export const SEM_VALOR = '—';

/**
 * Converte para número apenas quando o resultado é utilizável.
 * `null`, `undefined`, string vazia, `NaN` e `Infinity` devolvem `null`.
 */
export function numeroSeguro(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** `1234.5` → `"R$ 1234.50"`; valor inválido → `"—"`. */
export function formatarMoeda(valor: unknown, fallback = SEM_VALOR): string {
  const n = numeroSeguro(valor);
  return n === null ? fallback : `R$ ${n.toFixed(2)}`;
}

/** `1234.5` → `"R$ 1.234,50"` (agrupamento pt-BR); valor inválido → `"—"`. */
export function formatarMoedaExtenso(valor: unknown, fallback = SEM_VALOR): string {
  const n = numeroSeguro(valor);
  if (n === null) return fallback;
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** `2`  → `"2%"`; `-3` → `"-3%"`; valor inválido → `"—"` (nunca `"undefined%"`). */
export function formatarPercentual(valor: unknown, fallback = SEM_VALOR): string {
  const n = numeroSeguro(valor);
  return n === null ? fallback : `${n}%`;
}

/** Aceita apenas datas que o JS consegue representar de fato. */
export function dataSegura(valor: unknown): Date | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;

  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** `"2026-10-07T12:00:00Z"` → `"07/10/2026"`; data inválida → `"—"`. */
export function formatarData(valor: unknown, fallback = SEM_VALOR): string {
  const data = dataSegura(valor);
  return data === null ? fallback : data.toLocaleDateString('pt-BR');
}

/** Igual a `formatarData`, com hora e minuto. */
export function formatarDataHora(valor: unknown, fallback = SEM_VALOR): string {
  const data = dataSegura(valor);
  if (data === null) return fallback;
  return `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/** Só os dígitos de um telefone — a base de toda validação de número. */
export function apenasDigitos(valor: unknown): string {
  return typeof valor === 'string' || typeof valor === 'number'
    ? String(valor).replace(/\D/g, '')
    : '';
}

/**
 * Telefone brasileiro discável: DDD + número, 10 dígitos (fixo) ou 11 (celular).
 * Pode vir com o código do país (55) na frente.
 */
export function telefoneDiscavel(telefone: unknown): boolean {
  const digitos = apenasDigitos(telefone);
  const semPais = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos;
  return semPais.length === 10 || semPais.length === 11;
}

/**
 * Link de conversa no WhatsApp, ou `null` quando o número não serve (FA-16).
 *
 * Antes a função montava o link com qualquer coisa: cliente sem telefone gerava
 * `https://wa.me/55?text=...`, um botão "Reengajar" que só abria uma aba
 * inútil. Devolver `null` deixa a decisão de esconder o botão com a UI.
 */
export function montarLinkWhatsapp(telefone: unknown, mensagem: string): string | null {
  if (!telefoneDiscavel(telefone)) return null;

  const digitos = apenasDigitos(telefone);
  const numeroCompleto = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${numeroCompleto}?text=${encodeURIComponent(mensagem)}`;
}
