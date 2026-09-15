import { formatTime } from "@/lib/calculations/dates";
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
