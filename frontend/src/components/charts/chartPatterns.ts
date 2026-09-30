/**
 * Texturas e utilitarios puros dos graficos Recharts (sem JSX).
 *
 * Fica separado de `chartA11y.tsx` de proposito: a regra
 * `react-refresh/only-export-components` so aceita um arquivo que exporta
 * componentes, e misturar `export const CHART_PATTERNS` com `export function
 * ChartLegend` no mesmo arquivo gera aviso de fast refresh a cada export.
 */

export type PatternShape =
  | { kind: 'solid' }
  | { kind: 'lines'; d: string; width?: number }
  | { kind: 'dots'; r: number };

export type PatternSpec = {
  /** slug usado no `id` do <pattern>; precisa ser unico dentro do documento */
  slug: string;
  /** nome legivel do padrao, exibido na legenda, no tooltip e na tabela */
  label: string;
  shape: PatternShape;
};

/**
 * Oito texturas distintas. Cada `<pattern>` usa um tile 6x6 com
 * `patternUnits="userSpaceOnUse"`, para que a densidade do traco seja sempre a
 * mesma, independente do tamanho da barra — um traco que estica junto com o
 * retangulo_some a textura justamente nas barras pequenas (e sao elas que
 * precisam de ajuda).
 */
export const CHART_PATTERNS: PatternSpec[] = [
  { slug: 'liso', label: 'preenchimento liso', shape: { kind: 'solid' } },
  { slug: 'diagonal', label: 'listras diagonais', shape: { kind: 'lines', d: 'M-1,1 L1,-1 M0,6 L6,0 M5,7 L7,5', width: 1.4 } },
  { slug: 'grade', label: 'xadrez', shape: { kind: 'lines', d: 'M3,0 V6 M0,3 H6', width: 1.4 } },
  { slug: 'pontos', label: 'pontos', shape: { kind: 'dots', r: 1.05 } },
  { slug: 'horizontal', label: 'listras horizontais', shape: { kind: 'lines', d: 'M0,1.5 H6 M0,4.5 H6', width: 1.6 } },
  { slug: 'vertical', label: 'listras verticais', shape: { kind: 'lines', d: 'M1.5,0 V6 M4.5,0 V6', width: 1.6 } },
  { slug: 'diagonal-invert', label: 'listras diagonais inversas', shape: { kind: 'lines', d: 'M-1,5 L1,7 M0,0 L6,6 M5,-1 L7,1', width: 1.4 } },
  { slug: 'onda', label: 'onda', shape: { kind: 'lines', d: 'M0,3 Q1.5,0 3,3 T6,3 M0,6 Q1.5,3 3,6 T6,6', width: 1.2 } },
];

/** Lado do tile de cada textura, em unidades de usuario do SVG. */
export const PATTERN_TILE = 6;

/**
 * Tinta que contrasta com a cor de preenchimento, mantendo o mesmo matiz.
 *
 * Derivar a tinta da propria cor (em vez de fixar preto/branco) garante o
 * contraste em *qualquer* tema e em qualquer tom escolhido pela paleta: um
 * "quase branco" sobre um preenchimento claro seria invisivel, que e
 * exatamente o tipo de defeito que so aparece na combinacao de tema que
 * ninguem testou.
 *
 * Aceita tanto o token cru (`199 89% 48%`, com ou sem alpha) quanto o formato ja
 * convertido por `toHsl` (`hsl(199, 89%, 48%)`). Extrair os numeros em vez de
 * fatiar por espaco e o que torna os dois formatos equivalentes —
 * `parseFloat('48%)')` devolve 48 sem reclamar, entao um parser ingenuo aceitava
 * o formato errado e devolvia `hsl(hsl(199,, 89%,, ...)`, que o navegador
 * descarta em silencio e o rotulo fica com o preto padrao, invisivel sobre os
 * preenchimentos escuros do tema escuro.
 */
export function contrastingInk(color: string): string {
  const numbers = color
    .replace(/hsl\(/gi, '')
    .replace(/\)/g, '')
    .split('/')[0]
    .match(/-?[\d.]+/g);

  // Sem 3 canais nao da para inverter luminosidade. Devolve a cor original em
  // vez de inventar uma que talvez nao contraste.
  if (!numbers || numbers.length < 3) return color;

  const [hue, saturation, lightnessRaw] = numbers;
  const lightness = parseFloat(lightnessRaw);
  if (Number.isNaN(lightness)) return color;

  const ink = lightness > 50 ? lightness * 0.22 : 100 - lightness * 0.22;
  return `hsl(${hue}, ${saturation}%, ${ink.toFixed(1)}%)`;
}

/** Preenchimento da i-esima serie: cor solida no indice 0, textura nos demais. */
export function seriesFill(prefix: string, index: number, colors: string[]): string {
  if (colors.length === 0) return 'transparent';
  const color = colors[index % colors.length];
  const spec = CHART_PATTERNS[index % CHART_PATTERNS.length];
  return spec.shape.kind === 'solid' ? color : `url(#${prefix}-${spec.slug})`;
}

/** Nome do padrao da i-esima serie — usado nas legendas, tooltips e tabelas. */
export function seriesPatternLabel(index: number): string {
  return CHART_PATTERNS[index % CHART_PATTERNS.length].label;
}

export type SeriesUnit = 'moeda' | 'numero';

export type SeriesDescriptor = {
  /** dataKey da serie no `data` do grafico */
  key: string;
  name: string;
  unit: SeriesUnit;
  kind: 'bar' | 'line';
  /** descricao textual do padrao/traco, para quem nao distingue as cores */
  pattern: string;
  /** `strokeDasharray` da serie em linha */
  dash?: string;
};

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
