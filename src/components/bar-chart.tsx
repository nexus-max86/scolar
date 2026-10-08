/** Graphique en barres en HTML/CSS pur : aucun script à télécharger, lisible sur petit écran. */
export function BarChart({
  data,
  format,
  color = "bg-brand-600",
  empty = "Pas encore de données.",
}: {
  data: { label: string; value: number }[];
  format?: (v: number) => string;
  color?: string;
  empty?: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (max === 0) return <p className="py-6 text-center text-sm text-gray-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[88px_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate text-gray-600" title={d.label}>{d.label}</span>
          <span className="h-5 rounded bg-gray-100">
            <span className={`block h-5 rounded ${color}`} style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
          </span>
          <span className="min-w-16 text-right font-medium tabular-nums">{format ? format(d.value) : d.value}</span>
        </li>
      ))}
    </ul>
  );
}
