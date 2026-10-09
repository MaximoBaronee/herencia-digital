interface BadgeProps {
  tone?: "default" | "accent" | "success" | "warning";
  children: string;
}

export function Badge({ tone = "default", children }: BadgeProps) {
  const toneClass = tone === "default" ? "" : `badge--${tone}`;
  return <span className={`badge ${toneClass}`.trim()}>{children}</span>;
}
