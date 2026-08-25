import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

interface TextProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

// Labeled text/number/date input.
export function TextField({ label, className = "", ...rest }: TextProps) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      <input className={`input ${className}`} {...rest} />
    </label>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

// Labeled select. Options are styled dark to match the theme.
export function SelectField({ label, children, className = "", ...rest }: SelectProps) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      {/* Use descendant selectors so options stay dark even inside <optgroup>. */}
      <select
        className={`input ${className} [&_option]:bg-aurora-bg2 [&_option]:text-slate-200 [&_optgroup]:bg-aurora-bg2 [&_optgroup]:font-medium [&_optgroup]:text-slate-400`}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}
