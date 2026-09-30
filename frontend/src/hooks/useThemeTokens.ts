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

/** Converte o formato interno `H S% L%` em `hsl(H, S%, L%)`, aceito por SVG e inline styles. */
export function toHsl(token: string): string {
  if (!token) return '';
  if (token.includes('/')) return `hsl(${token})`;
  return `hsl(${token.split(/\s+/).join(', ')})`;
}
