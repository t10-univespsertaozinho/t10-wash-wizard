import { useTheme as useNextTheme } from 'next-themes';

export type Theme = 'light' | 'dark' | 'system';

/**
 * Fonte unica de verdade do tema.
 *
 * A aplicacao ja monta `ThemeProvider` (next-themes) em `App.tsx` com
 * `attribute="class"`, `enableSystem` e `defaultTheme="system"`. Esta e a
 * implementacao anterior, local e nao reativa: ela escrevia na mesma chave
 * `localStorage` e manipulava `documentElement.classList` por conta propria,
 * disputando o controle de classe com o next-themes.
 *
 * Reexportamos o hook do next-themes para que `setTheme`, a persistencia e a
 * classe em `<html>` tenham um unico dono. Assim `resolvedTheme` e reativo e
 * qualquer consumidor re-renderiza no instante da troca de tema.
 */
export function useTheme() {
  return useNextTheme();
}

/**
 * Indica de forma REATIVA se o tema efetivo (ja resolvido) e escuro.
 *
 * Substitui a antiga `isDarkTheme()`, que lia `documentElement.classList` no
 * corpo da funcao: como nao passava por estado do React, nao disparava
 * re-render e devolvia um valor obsoleto em qualquer render seguinte a troca de
 * tema. Para virar hook (e ler `resolvedTheme` do next-themes) o nome precisa do
 * prefixo `use`, conforme as regras de hooks.
 */
export function useIsDarkTheme(): boolean {
  const { resolvedTheme } = useNextTheme();
  return resolvedTheme === 'dark';
}
