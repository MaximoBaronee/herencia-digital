import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "default";
}

export function Button({ variant = "default", className = "", ...props }: ButtonProps) {
  const classes = ["button", variant === "primary" ? "button--primary" : "", className].filter(Boolean).join(" ");
  return <button className={classes} {...props} />;
}
