import { useMemo } from 'react';
import { useCssTokens } from '@/hooks/useThemeTokens';
import { CHART_TOKEN_NAMES, PALETTE_FALLBACK, isRenderableColor } from './chartSeries';

/**
 * Paleta das series, ja pronta para virar `fill`/`stroke` do SVG.
 *
 * `--chart-*` no CSS e uma cor completa (hex), nao a tripla "H S% L%" dos outros
 * tokens, entao aqui nao existe montagem de string: o valor lido do tema segue
 * direto para o atributo. Foi exatamente a montagem em JS que quebrou a paleta
 * uma vez — `toHsl()` produzia `hsl(201.57%, ...)` por causa do hue em
 * porcentagem, o navegador descartava o atributo e todas as barras saiam pretas.
 *
 * Dois motivos para ainda ler do CSS em vez de so importar `PALETTE_FALLBACK`:
 * trocar de tema tem que trocar a paleta junto (o claro usa luminosidade
 * diferente para as seis passarem 4.5:1 sobre branco), e ler do CSS mantem o
 * hex do CSS como fonte da verdade.
 *
 * Leitura vazia ou nao reconhecida cai em `PALETTE_FALLBACK`. Um SVG com `fill`
 * invalido desenha preto, que e o pior resultado posible num grafico de dados,
 * entao aqui a falha preferida e a cor de referencia — e nao `''`.
 */
export function useChartPalette(): readonly string[] {
  const tokens = useCssTokens(CHART_TOKEN_NAMES);

  return useMemo(
    () =>
      CHART_TOKEN_NAMES.map((name, i) => {
        const value = tokens[name];
        return isRenderableColor(value) ? value.trim() : PALETTE_FALLBACK[i];
      }),
    // `tokens` e um objeto novo a cada leitura do tema, entao e ele mesmo a
    // dependencia: a paleta so recalcula quando o tema muda.
    [tokens],
  );
}
