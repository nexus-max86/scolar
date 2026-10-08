/** Graphique en barres en HTML/CSS pur : aucun script à télécharger, lisible sur petit écran. */
export function BarChart({
  data,
  format,
  empty = "Pas encore de données.",
}: {
  data: { label: string; value: number }[];
  format?: (v: number) => string;
  empty?: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (max === 0) return <p className="py-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[92px_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted" title={d.label}>{d.label}</span>
          <span className="h-2 rounded-full bg-gray-100">
            {d.value > 0 && <span className="block h-2 rounded-full bg-brand-500" style={{ width: `${Math.max(3, (d.value / max) * 100)}%` }} />}
          </span>
          <span className="min-w-20 text-right tabular-nums text-ink">{format ? format(d.value) : d.value}</span>
        </li>
      ))}
    </ul>
  );
}
