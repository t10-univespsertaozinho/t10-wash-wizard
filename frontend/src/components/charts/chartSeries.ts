/**
 * Metadados e utilitarios puros dos graficos Recharts (sem JSX).
 *
 * Fica separado de `chartA11y.tsx` de proposito: a regra
 * `react-refresh/only-export-components` so aceita um arquivo que exporta
 * componentes, e misturar `export const PALETTE` com `export function
 * ChartLegend` no mesmo arquivo gera aviso de fast refresh a cada export.
 */

export type SeriesUnit = 'moeda' | 'numero';

export type SeriesKind = 'bar' | 'line';

export type SeriesDescriptor = {
  /** dataKey da serie no `data` do grafico */
  key: string;
  /** nome limpo, exibido na legenda, no tooltip e na tabela */
  name: string;
  unit: SeriesUnit;
  kind: SeriesKind;
  /** `strokeDasharray` da serie em linha */
  dash?: string;
};

/**
 * Paleta Okabe-Ito, na ordem dos tokens `--chart-1..6`.
 *
 * Okabe-Ito e a paleta de referencia para daltonismo: os pares de matiz nao
 * colapsam sob protanopia, deuteranopia ou tritanopia, porque nenhum par
 * depende da diferenca vermelho x verde. Nao e garantia de que a cor deixe de
 * ser o unico canal — e por isso que toda serie continua com nome na legenda,
 * valor no tooltip e linha na tabela `sr-only`.
 *
 * Os valores ficam em `index.css` (tokens `--chart-*`) e sao lidos em runtime
 * por `useChartPalette`, para que trocar de tema troque a paleta junto. Aqui so
 * ficam o nome legivel e o hex de reserva.
 */
export const PALETTE_NAMES = [
  'Azul',
  'Âmbar',
  'Cyan',
  'Rosa',
  'Verde',
  'Tijolo',
] as const;

/** Nomes dos tokens lidos do tema ativo, na ordem da paleta. */
export const CHART_TOKEN_NAMES = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--chart-6',
] as const;

/**
 * Okabe-Ito de referencia, em hex.
 *
 * Duplo proposito. Primeiro, e o valor de reserva de `useChartPalette`: um SVG
 * com `fill` invalido desenha preto, entao qualquer leitura vazia ou nao
 * reconhecida tem de cair num hex conhecido em vez de virar `''` ou
 * `undefined`. Segundo, e a referencia de revisao — se `--chart-*` no CSS
 * divergir daqui, o harness acusa em vez de a palete mudar calada.
 */
export const PALETTE_FALLBACK = [
  '#0072B2',
  '#E69F00',
  '#56B4E9',
  '#CC79A7',
  '#009E73',
  '#D55E00',
] as const;

/** Funcoes CSS que produzem cor. `var(...)` e a unica aninhamento aceito. */
const COLOR_FNS = /^(?:hsl|hwb|lab|lch|oklab|oklch|rgb|rgba|hsla|color)$/i;

/**
 * Diz se a string e uma cor que o SVG sabe desenhar.
 *
 * Este e o guarda-corpo entre o token do CSS e o atributo `fill`. Um atributo
 * invalido nao da erro: o navegador simplesmente descarta e pinta de preto, que
 * foi como a paleta inteira sumiu do Dashboard. Entao aqui a lista do que passa
 * e curta e explicita, em vez de "parece com uma cor".
 *
 * Passa: hex de 3, 4, 6 ou 8 digitos, e as funcoes de cor do CSS — incluindo
 * com `var()` dentro, que e como o separador entre segmentos e escrito.
 *
 * Barrado, de proposito:
 *   - a tripla HSL crua do token ("201.57% 100% 34.9%"), que exige montagem e
 *     por isso nao deve chegar ao atributo;
 *   - `hsl()` com hue em porcentagem ("hsl(201.57%, 100%, 34.9%)") — invalido,
 *     porque em hsl() o hue e `<number> | <angle>`. Foi o que derrubou a paleta;
 *   - `undefined`, `null`, `NaN`, string vazia e funcao aninhada que nao seja var().
 */
export function isRenderableColor(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim();
  if (!v) return false;

  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return true;

  const fn = v.match(/^([a-z]+)\((.*)\)$/i);
  if (!fn || !COLOR_FNS.test(fn[1])) return false;

  // dentro da cor so pode aparecer var(); qualquer outro parenteses e aninhamento
  const semVar = fn[2].replace(/var\([^()]*\)/gi, '');
  if (/[()]/.test(semVar)) return false;

  // hsl/hsla: o primeiro componente e o hue e ele nao aceita porcentagem.
  // Se for var(), nao da para saber -> aceita.
  if (/^hsla?$/i.test(fn[1])) {
    const hue = semVar.trim().split(/[\s,/]+/)[0] ?? '';
    if (hue && !/^var\(/i.test(hue) && hue.endsWith('%')) return false;
    if (hue && Number.isNaN(parseFloat(hue))) return false;
  }

  return true;
}




export function formatChartValue(unit: SeriesUnit, value: number | string | undefined): string {
  const n = typeof value === 'number' ? value : Number(value);
  const safe = Number.isFinite(n) ? (n as number) : 0;
  return unit === 'moeda'
    ? safe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : safe.toLocaleString('pt-BR');
}

export const unitLabel: Record<SeriesUnit, string> = {
  moeda: 'valor em reais (R$)',
  numero: 'quantidade',
};

/**
 * Props de acessibilidade para o SVG do Recharts.
 *
 * `role="img"` + `title`/`desc`: o grafico vira uma imagem com nome proprio,
 * lida uma vez e seguida da tabela `sr-only` com os numeros.
 *
 * Deliberadamente **sem** `accessibilityLayer`: no Recharts 2.15 ele troca o
 * papel do SVG por `role="application"` e prende as setas do teclado num cursor
 * interno sem colocar nenhum `aria-label` no elemento — quem usa leitor de tela
 * focaria um "application" que engole as teclas e nao anuncia nada. Pior que nao
 * ter navegacao por teclado. A tabela faz esse papel com fiabilidade.
 */
export function chartA11yProps(shortTitle: string, description: string) {
  return { role: 'img' as const, title: shortTitle, desc: description };
}
