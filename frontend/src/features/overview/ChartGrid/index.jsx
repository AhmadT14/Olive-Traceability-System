import Card from "../../../components/Card";
import BarChart from "../../../components/BarChart";
import { TEXT } from "../strings";
import "./style.css";

// Overview charts, one card each: { title, data, unit, horizontal,
// available }. A chart with available false shows a note instead.
export default function ChartGrid({ charts }) {
  return (
    <div className="chart-grid">
      {charts.map((chart) => (
        <Card key={chart.title} title={chart.title}>
          {chart.available === false ? (
            <p className="chart-grid__missing">{TEXT.chartMissing}</p>
          ) : (
            <BarChart
              data={chart.data}
              unit={chart.unit}
              title={chart.title}
              horizontal={chart.horizontal}
              emptyText={TEXT.noData}
              tableLabel={TEXT.table}
            />
          )}
        </Card>
      ))}
    </div>
  );
}
