import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
  children: ReactNode;
}

// Thin wrapper over the .btn-* utility classes so buttons stay consistent.
export function Button({ variant = "primary", children, className = "", ...rest }: Props) {
  const base = variant === "primary" ? "btn-primary" : "btn-ghost";
  return (
    <button className={`${base} ${className}`} {...rest}>
      {children}
    </button>
  );
}
