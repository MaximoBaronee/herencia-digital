interface StatProps {
  title: string;
  value: string;
  hint?: string;
}

export function Stat({ title, value, hint }: StatProps) {
  return (
    <section className="card">
      <h2 className="card__title">{title}</h2>
      <div className="stat__value">{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </section>
  );
}
