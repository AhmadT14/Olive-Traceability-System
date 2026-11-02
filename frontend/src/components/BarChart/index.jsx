import {
  Bar,
  BarChart as Chart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./style.css";

// `unit` is { one, other }: "1 batch", "4 batches".
function amount(value, unit) {
  return `${value.toLocaleString()} ${value === 1 ? unit.one : unit.other}`;
}

function ChartTooltip({ active, payload, unit }) {
  if (!active || !payload || !payload.length) return null;
  const { label, value } = payload[0].payload;
  return (
    <div className="bar-chart__tooltip">
      <span>{label}</span>
      <strong>{amount(value, unit)}</strong>
    </div>
  );
}

const tick = { fill: "var(--color-text-muted)", fontSize: 12 };

// One series of bars from [{ label, value }], with a hover tooltip and a
// table view. `horizontal` puts the labels on the left (long category names).
export default function BarChart({
  data,
  unit,
  title,
  horizontal = false,
  emptyText,
  tableLabel = "Show as a table",
}) {
  if (!data.some((d) => d.value > 0)) {
    return <p className="bar-chart__empty">{emptyText}</p>;
  }
  const height = horizontal ? Math.max(data.length * 36 + 40, 160) : 220;
  const axisLabels = new Map(data.map((d) => [d.label, d.short ?? d.label]));
  const valueAxis = {
    type: "number",
    allowDecimals: false,
    tick,
    axisLine: false,
    tickLine: false,
  };
  const labelAxis = {
    type: "category",
    dataKey: "label",
    tick,
    axisLine: { stroke: "var(--color-border)" },
    tickLine: false,
    interval: 0,
  };

  return (
    <figure className="bar-chart">
      <div role="img" aria-label={title}>
        <ResponsiveContainer width="100%" height={height}>
          <Chart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              stroke="var(--color-border)"
              strokeDasharray="2 4"
              horizontal={!horizontal}
              vertical={horizontal}
            />
            {horizontal ? (
              <>
                <XAxis {...valueAxis} />
                <YAxis {...labelAxis} width={130} />
              </>
            ) : (
              <>
                <XAxis
                  {...labelAxis}
                  tickFormatter={(label) => axisLabels.get(label)}
                />
                <YAxis {...valueAxis} width={40} />
              </>
            )}
            <Tooltip
              content={<ChartTooltip unit={unit} />}
              cursor={{ fill: "var(--color-surface-2)", opacity: 0.6 }}
            />
            <Bar
              dataKey="value"
              fill="var(--color-chart)"
              maxBarSize={24}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </Chart>
        </ResponsiveContainer>
      </div>
      <details className="bar-chart__table">
        <summary>{tableLabel}</summary>
        <table>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <th scope="row">{d.label}</th>
                <td>{amount(d.value, unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
