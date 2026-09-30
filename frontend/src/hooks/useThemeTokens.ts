import { useCallback, useEffect, useState } from 'react';

type TokenMap = Record<string, string>;

function readTokens(names: readonly string[]): TokenMap {
  if (typeof window === 'undefined') return {};
  const styles = window.getComputedStyle(window.document.documentElement);
  const tokens: TokenMap = {};
  for (const name of names) {
    tokens[name] = styles.getPropertyValue(name).trim();
  }
  return tokens;
}

/**
 * Le tokens CSS do tema ativo (`:root` no escuro, `.light` no claro) e re-renderiza
 * quando o `next-themes` troca a classe em `<html>`, permitindo que graficos Recharts
 * recebam cores resolvidas em JS (o SVG nao resolve `var()` de forma confiavel).
 */
export function useCssTokens<T extends string>(names: readonly T[]): Record<T, string> {
  const key = names.join('|');

  const read = useCallback((): Record<T, string> => {
    return readTokens(key.split('|')) as Record<T, string>;
  }, [key]);

  const [tokens, setTokens] = useState<Record<T, string>>(read);

  useEffect(() => {
    setTokens(read());

    const observer = new MutationObserver(() => setTokens(read()));
    observer.observe(window.document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => setTokens(read());
    media.addEventListener('change', handleMediaChange);

    return () => {
      observer.disconnect();
      media.removeEventListener('change', handleMediaChange);
    };
  }, [read]);

  return tokens;
}

/**
 * Monta uma cor CSS a partir do formato interno `H S% L%` dos tokens de tema.
 *
 * Esta funcao ja deixou a paleta inteira dos graficos cair para preto: ela
 * assumia que o hue vinha sem unidade e devolvia `hsl(201.57%, 100%, 34.9%)`
 * quando o token trazia o hue em porcentagem. Isso e invalido — em `hsl()` o
 * hue e `<number> | <angle>`, nunca `<percentage>` — entao o navegador descartava
 * o atributo e o SVG desenhava preto. Por isso as tres salvacoes:
 *
 * 1. token vazio devolve `''`, nunca `hsl(undefined)`;
 * 2. token que ja e uma cor completa (`hsl(...)`, `rgb(...)`, hex) passa direto,
 *    o que impede o `hsl(hsl(...))` de um token ja resolvido;
 * 3. hue em porcentagem e normalizado para numero antes de formatar.
 *
 * Prefira passar hex direto quando nao houver troca de tema a respeitar.
 */
export function toHsl(token: string): string {
  const raw = (token ?? '').trim();
  if (!raw) return '';

  // ja e uma cor completa: nao embrulhar de novo
  if (/^(hsl|rgb|rgba|hsla|oklch|color|lab|lch)\(/i.test(raw) || raw.startsWith('#')) {
    return raw;
  }

  // `H S% L%`, opcionalmente com `/ alfa`
  const [corpo, alfa] = raw.split('/').map(p => p.trim());
  if (!corpo) return '';

  const partes = corpo.split(/\s+/);
  if (partes.length !== 3) return '';

  const [h, s, l] = partes;
  if (h.endsWith('%')) return '';
  if (!s.endsWith('%') || !l.endsWith('%')) return '';

  return alfa ? `hsl(${h}, ${s}, ${l} / ${alfa})` : `hsl(${h}, ${s}, ${l})`;
}

