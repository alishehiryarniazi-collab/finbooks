import { useState, type InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

// Password input with a show/hide (eye) toggle so users can verify what they typed.
// Uses logical properties (pe-*/end-*) so it stays correct in RTL languages.
export function PasswordField({ label, className = "", ...rest }: Props) {
  const [show, setShow] = useState(false);

  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className={`input pe-11 ${className}`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          // tabIndex -1 so keyboard users tab straight from password to submit.
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 end-0 flex items-center px-3 text-slate-400 transition hover:text-aurora-mint"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

function EyeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7M6.2 6.7A17 17 0 0 0 2.5 12S6 18.5 12 18.5c.8 0 1.5-.1 2.2-.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
