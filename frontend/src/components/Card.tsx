import type { ReactNode } from "react";

interface CardProps {
  title: string;
  children: ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <section className="card">
      <h2 className="card__title">{title}</h2>
      {children}
    </section>
  );
}
