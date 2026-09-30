import { formatChartValue, unitLabel, type SeriesDescriptor } from './chartSeries';

/**
 * Componentes de acessibilidade e acabamento dos graficos Recharts.
 *
 * A distincao entre series vem da paleta Okabe-Ito (tokens `--chart-*`), cujos
 * pares de matiz nao colapsam sob protanopia, deuteranopia ou tritanopia. O que
 * este arquivo garante e o resto do canal: cada serie tem **nome** na legenda,
 * **valor** no tooltip e **linha** na tabela `sr-only`, para que a cor nunca
 * seja a unica coisa que carrega a informacao.
 */

/** Amostra da cor da serie, no formato que o grafico usa. */
function Swatch({
  kind,
  color,
  dash,
  size = 14,
}: {
  kind: SeriesDescriptor['kind'];
  color: string;
  dash?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      className="shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'bar' ? (
        <rect x="1.5" y="3.5" width="11" height="7" rx="2" fill={color} />
      ) : (
        <line
          x1="1"
          y1="7"
          x2="13"
          y2="7"
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
 * Legenda limpa: so o nome da categoria e uma amostra da cor/traco.
 *
 * Nao repete descricao de textura aqui — o nome da serie ja e o rotulo, e a
 * tabela `sr-only` abaixo do grafico carrega os valores.
 */
export function ChartLegend({
  items,
  colors,
}: {
  items: SeriesDescriptor[];
  colors: string[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-xs text-muted-foreground">
      {items.map((item, i) => (
        <li key={item.key} className="flex items-center gap-2">
          <Swatch kind={item.kind} color={colors[i % Math.max(colors.length, 1)]} dash={item.dash} />
          <span className="font-medium text-foreground">{item.name}</span>
        </li>
      ))}
    </ul>
  );
}

type TooltipEntry = { dataKey?: string | number; name?: string; value?: number | string };

/**
 * Tooltip: fundo, borda e sombra vindos de `contentStyle`, que o Dashboard
 * deriva dos tokens do tema ativo — nada de cor fixa aqui.
 *
 * `role="tooltip"` mantem a associacao com o elemento focado. O rodape em
 * `sr-only` reza a lista nome/valor por extenso para leitores de tela, que
 * enxergam o conteudo do tooltip mas nao a posicao do cursor.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  items,
  colors,
  contentStyle,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  items: SeriesDescriptor[];
  colors: string[];
  contentStyle?: React.CSSProperties;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      role="tooltip"
      style={contentStyle}
      className="min-w-[10rem] px-3.5 py-2.5 shadow-xl"
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-1">
        {payload.map((entry, i) => {
          const index = items.findIndex((item) => item.key === entry.dataKey);
          const item = items[index] ?? items[i];
          return (
            <li key={String(entry.dataKey ?? i)} className="flex items-center gap-2 text-xs">
              <Swatch kind={item.kind} color={colors[index % Math.max(colors.length, 1)]} dash={item.dash} size={12} />
              <span className="text-muted-foreground">{item.name}</span>
              <strong className="ml-auto font-semibold tabular-nums">
                {formatChartValue(item.unit, entry.value)}
              </strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Geometria que o Recharts injeta no `LabelList` renderizado. */
type LabelGeometry = {
  x?: number;
  y?: number;
  width?: number;
  value?: number | string;
};

/**
 * Valor acima da barra, no grafico de serie unica.
 *
 * `color` recebe a tinta de texto do tema, nao a cor da serie: o numero fica
 * acima do retangulo, sobre o fundo do card, entao quem tem de contrastar com
 * o card e a cor da barra.
 */
export function BarValue({ color, x = 0, y = 0, width = 0, value }: LabelGeometry & { color: string }) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n === 0 || width < 10) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      fill={color}
      fontSize={11}
      fontWeight={600}
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
