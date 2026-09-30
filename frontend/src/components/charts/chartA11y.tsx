import {
  CHART_PATTERNS,
  PATTERN_TILE,
  contrastingInk,
  formatChartValue,
  seriesFill,
  unitLabel,
  type SeriesDescriptor,
} from './chartPatterns';

/**
 * Componentes de acessibilidade dos graficos Recharts (WCAG 1.4.1 - Uso de Cor).
 *
 * Cor, sozinha, nao pode ser o unico meio de transmiter informacao: pessoas com
 * daltonismo (em especial deuteranopia/protanopia, que confundem vermelho e verde)
 * e com baixa visao nao distinguem series que so diferem em matiz.
 *
 * Aqui ficam tres canais redundantes de codificacao, um por grafico:
 *  1. textura (listras/pontos/xadrez) desenhada dentro de cada barra;
 *  2. traco pontilhado distinto na serie em linha;
 *  3. rotulo numerico direto no proprio segmento.
 * Mais tooltip com rotulo textual, legenda que nomeia o padrao de cada serie e
 * uma tabela `sr-only` com os numeros — para quem nao enxerga o SVG.
 */

/**
 * `<defs>` com um `<pattern>` por textura.
 *
 * Fica num `<svg>` proprio, **fora** do grafico, de proposito: o Recharts
 * descarta os filhos que ele nao reconhece e ainda emite o proprio `<defs>`
 * (para os clipPath), engolindo o que fosse passado la dentro — checado no
 * DOM, o `<defs>` do Recharts simplesmente nao aparecia.
 *
 * `fill="url(#id)"` e resolvido por id em todo o documento, nao por escopo de
 * SVG, entao o padrao definido num `<svg>` e referenciado de outro funciona. O
 * SVG e `aria-hidden`: nao desenha nada, so define textura.
 *
 * Renderiza as 8 texturas em vez de so as usadas, porque `seriesFill` faz indice
 * modulo pelo numero de cores: sem o padrao da 8a posicao, uma serie nela
 * receberia `url(#id-inexistente)` e o navegador cairia no fallback preto.
 */
export function ChartPatternDefs({ prefix, colors }: { prefix: string; colors: string[] }) {
  if (colors.length === 0) return null;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={0}
      height={0}
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <defs>
        {CHART_PATTERNS.map((spec, i) => {
          const color = colors[i % colors.length];
          return (
            <pattern
              key={`${prefix}-${spec.slug}`}
              id={`${prefix}-${spec.slug}`}
              patternUnits="userSpaceOnUse"
              width={PATTERN_TILE}
              height={PATTERN_TILE}
            >
              <rect width={PATTERN_TILE} height={PATTERN_TILE} fill={color} />
              {spec.shape.kind === 'lines' && (
                <path
                  d={spec.shape.d}
                  fill="none"
                  stroke={contrastingInk(color)}
                  strokeWidth={spec.shape.width ?? 1.4}
                />
              )}
              {spec.shape.kind === 'dots' && (
                <>
                  <circle cx={1.5} cy={1.5} r={spec.shape.r} fill={contrastingInk(color)} />
                  <circle cx={4.5} cy={4.5} r={spec.shape.r} fill={contrastingInk(color)} />
                </>
              )}
            </pattern>
          );
        })}
      </defs>
    </svg>
  );
}

function Swatch({
  kind,
  index,
  prefix,
  colors,
  dash,
  size = 18,
}: {
  kind: 'bar' | 'line';
  index: number;
  prefix: string;
  colors: string[];
  dash?: string;
  size?: number;
}) {
  const color = colors[index % Math.max(colors.length, 1)] ?? 'hsl(0, 0%, 50%)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      className="shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'bar' ? (
        <rect
          x="1"
          y="3"
          width="16"
          height="12"
          rx="1.5"
          fill={seriesFill(prefix, index, colors)}
          stroke={contrastingInk(color)}
          strokeWidth="1"
        />
      ) : (
        <line
          x1="1"
          y1="9"
          x2="17"
          y2="9"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={dash}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/**
 * Legenda detalhada: cada item mostra a mesma textura/traco da serie e nomeia o
 * padrao em texto. A `Legend` do Recharts renderizada crua mostraria apenas um
 * retangulo colorido, que e justamente a informacao que nao pode ser a unica.
 */
export function ChartLegend({
  items,
  colors,
  prefix,
}: {
  items: SeriesDescriptor[];
  colors: string[];
  prefix: string;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-muted-foreground">
      {items.map((item, i) => (
        <li key={item.key} className="flex items-center gap-2">
          <Swatch kind={item.kind} index={i} prefix={prefix} colors={colors} dash={item.dash} />
          <span className="font-semibold text-foreground">{item.name}</span>
          <span>
            {item.kind === 'bar' ? 'padrão' : 'traço'}: {item.pattern}
          </span>
        </li>
      ))}
    </ul>
  );
}

type TooltipEntry = { dataKey?: string | number; name?: string; value?: number | string };

/**
 * Tooltip com leitura em texto: nome da serie + valor ja formatado na unidade
 * correta (R$ x,xx). O `role="tooltip"` mantem a associacao com o elemento
 * focado; o resumo em `sr-only` diz qual textura corresponde a cada serie.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  items,
  colors,
  prefix,
  contentStyle,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  items: SeriesDescriptor[];
  colors: string[];
  prefix: string;
  contentStyle?: React.CSSProperties;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div role="tooltip" style={contentStyle} className="px-3 py-2 shadow-lg">
      <p className="mb-1 font-semibold">{label}</p>
      <ul className="space-y-0.5">
        {payload.map((entry, i) => {
          const index = items.findIndex((item) => item.key === entry.dataKey);
          const item = items[index] ?? items[i];
          return (
            <li key={String(entry.dataKey ?? i)} className="flex items-center gap-2">
              <Swatch kind={item.kind} index={index} prefix={prefix} colors={colors} dash={item.dash} size={14} />
              <span>{item.name}:</span>
              <strong>{formatChartValue(item.unit, entry.value)}</strong>
            </li>
          );
        })}
      </ul>
      <p className="sr-only">
        Texturas: {items.map((item) => `${item.name} (${item.kind === 'bar' ? 'padrão' : 'traço'} ${item.pattern})`).join('; ')}.
      </p>
    </div>
  );
}

/** Geometria que o Recharts injeta no `LabelList` renderizado. */
type LabelGeometry = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number | string;
};

/**
 * Rotulo numerico dentro do segmento da barra empilhada. Abaixo de ~13px de
 * altura o numero vira borrao e atrapalha mais do que ajuda, entao o segmento
 * pequeno e omitido — nesses casos quem precisa do valor exato usa o tooltip ou
 * a tabela `sr-only`.
 */
export function SegmentValue({ color, x = 0, y = 0, width = 0, height = 0, value }: LabelGeometry & { color: string }) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  if (height < 13 || width < 18) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fill={contrastingInk(color)}
      fontSize={11}
      fontWeight={700}
      pointerEvents="none"
    >
      {n}
    </text>
  );
}

/** Rotulo numerico acima da barra, para graficos de serie unica. */
export function BarValue({ color, x = 0, y = 0, width = 0, value }: LabelGeometry & { color: string }) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n === 0 || width < 10) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      textAnchor="middle"
      fill={color}
      fontSize={11}
      fontWeight={700}
      pointerEvents="none"
    >
      {n}
    </text>
  );
}

export type ChartTableSpec = {
  caption: string;
  /** primeira coluna e o rotulo do periodo (ex.: 'Jan') */
  rowLabel: string;
  columns: SeriesDescriptor[];
  rows: { label: string; values: (number | string)[] }[];
};

/**
 * Equivalente textual do grafico, exposto apenas para leitores de tela.
 * Sem isso, a informacao do grafico so existe como pixel — um leitor de tela
 * anuncia "image" ou o nome da serie, nunca os valores.
 */
export function ChartDataTable({ caption, rowLabel, columns, rows }: ChartTableSpec) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{rowLabel}</th>
          {columns.map((col) => (
            <th key={col.key} scope="col">
              {col.name} — {unitLabel[col.unit]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            {row.values.map((value, i) => (
              <td key={columns[i]?.key ?? i}>{formatChartValue(columns[i]?.unit ?? 'numero', value)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
