type Props = {
  label: string;
  value: number | string;
  hint?: string;
};

export function MetricCard({ label, value, hint }: Props) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  );
}
