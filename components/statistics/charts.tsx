import { formatTime } from "@/lib/calculations/dates";
import type { AnnualHeatmapCell } from "@/lib/calculations/decision";

export function BarChart({
  values,
  labels,
  label,
  color = "var(--moss)",
}: {
  values: number[];
  labels: string[];
  label: string;
  color?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div
      className="bar-chart"
      role="img"
      aria-label={`${label}: ${values.map((v, i) => `${labels[i]} ${formatTime(v)}`).join(", ")}`}
    >
      <div className="bars">
        {values.map((v, i) => (
          <div
            className="bar-column"
            key={i}
            title={`${labels[i]}: ${formatTime(v)}`}
          >
            <div className="bar-track">
              <div
                style={{
                  height: `${v ? Math.max(2, (v / max) * 100) : 0}%`,
                  background: color,
                }}
              />
            </div>
            <span>{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  items,
  total,
  label,
}: {
  items: { id: string; name: string; value: number; color: string }[];
  total: number;
  label: string;
}) {
  const visibleItems = items.filter((item) => item.value > 0);
  const stops = visibleItems.map((item, index) => {
    const start =
      (visibleItems
        .slice(0, index)
        .reduce((sum, current) => sum + current.value, 0) /
        Math.max(1, total)) *
      100;
    const end = start + (item.value / Math.max(1, total)) * 100;
    return `${item.color} ${start}% ${end}%`;
  });
  const background = stops.length
    ? `conic-gradient(${stops.join(", ")})`
    : "var(--surface-muted)";
  return (
    <div
      className="donut-chart"
      role="img"
      aria-label={`${label}: ${items.map((item) => `${item.name} ${Math.round((item.value / Math.max(1, total)) * 100)}%`).join(", ")}`}
    >
      <div className="donut-ring" style={{ background }}>
        <div className="donut-center">
          <strong>{formatTime(total)}</strong>
          <span>нийт</span>
        </div>
      </div>
      <div className="donut-legend">
        {items.slice(0, 8).map((item) => (
          <div key={item.id}>
            <span>
              <i
                className="subject-dot"
                style={{ background: item.color }}
                aria-hidden="true"
              />
              {item.name}
            </span>
            <strong>
              {Math.round((item.value / Math.max(1, total)) * 100)}%
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnnualHeatmap({
  weeks,
  year,
}: {
  weeks: AnnualHeatmapCell[][];
  year: number;
}) {
  return (
    <div
      className="heatmap-shell"
      role="region"
      aria-label={`${year} оны суралцах heatmap`}
    >
      <div className="heatmap-scroll">
        <div className="heatmap-weekdays" aria-hidden="true">
          <span>Дв</span>
          <span>Лх</span>
          <span>Пү</span>
          <span>Ба</span>
          <span>Бя</span>
          <span>Ня</span>
        </div>
        <div className="heatmap-body">
          <div className="heatmap-months" aria-hidden="true">
            {weeks.map((week, index) => {
              const cell = week.find((day) => day.inYear);
              const month = cell ? cell.date.slice(5, 7) : "";
              const previous = weeks[index - 1]?.find((day) => day.inYear);
              const monthChanged =
                Boolean(cell) &&
                (index === 0 || previous?.date.slice(0, 7) !== month);
              return (
                <span key={index}>{monthChanged ? month : ""}</span>
              );
            })}
          </div>
          <div className="heatmap-grid">
            {weeks.map((week, index) => (
              <div className="heatmap-week" key={index}>
                {week.map((day) => (
                  <div
                    className={`heatmap-cell level-${day.level} ${day.inYear ? "" : "outside"}`}
                    key={day.date}
                    title={
                      day.inYear
                        ? `${day.date} · ${formatTime(day.minutes * 60)}`
                        : day.date
                    }
                    aria-label={
                      day.inYear
                        ? `${day.date}, ${formatTime(day.minutes * 60)}`
                        : `${day.date}, тухайн жилийн гадна`
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-legend" aria-hidden="true">
        <span>Бага</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <i key={level} className={`heatmap-cell level-${level}`} />
        ))}
        <span>Их</span>
      </div>
    </div>
  );
}
