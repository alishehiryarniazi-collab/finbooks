import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

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

// --- Custom themed select ----------------------------------------------------
// Native <select> popups are OS-styled and never match the dark Aurora theme.
// This component keeps the familiar <SelectField><option/>…</SelectField> API but
// renders a fully themed dropdown (via a portal so it never gets clipped by a
// scrolling table). onChange is called with a minimal {target:{value}} so existing
// `onChange={(e) => set(e.target.value)}` handlers keep working unchanged.

interface Opt {
  value: string;
  label: string;
  disabled?: boolean;
}
interface Group {
  group: string;
  options: Opt[];
}
type Item = Opt | Group;

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

// Flattens a React node (e.g. `{a.code} · {a.name}`) into a plain string label.
function textOf(node: ReactNode): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

function parseItems(children: ReactNode): Item[] {
  const items: Item[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "optgroup") {
      const props = child.props as { label?: string; children?: ReactNode };
      const options: Opt[] = [];
      Children.forEach(props.children, (o) => {
        if (isValidElement(o) && o.type === "option") {
          const op = o.props as { value?: unknown; children?: ReactNode; disabled?: boolean };
          options.push({ value: String(op.value ?? ""), label: textOf(op.children), disabled: op.disabled });
        }
      });
      items.push({ group: props.label ?? "", options });
    } else if (child.type === "option") {
      const op = child.props as { value?: unknown; children?: ReactNode; disabled?: boolean };
      items.push({ value: String(op.value ?? ""), label: textOf(op.children), disabled: op.disabled });
    }
  });
  return items;
}

function flatOptions(items: Item[]): Opt[] {
  return items.flatMap((it) => ("group" in it ? it.options : [it]));
}

export function SelectField({
  label,
  children,
  className = "",
  value,
  onChange,
  disabled,
  required,
}: SelectProps) {
  const items = parseItems(children);
  const options = flatOptions(items);
  const current = value !== undefined ? String(value) : "";
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  // Position the portal panel right under the button.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, [open]);

  // Close on outside click, Escape, scroll or resize.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Close when the PAGE scrolls (the fixed panel would detach from the button), but
    // NOT when scrolling inside the panel's own option list.
    const onScroll = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function pick(v: string) {
    // Synthesize just enough of a change event for existing handlers.
    onChange?.({ target: { value: v } } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  }

  const renderOption = (o: Opt) => {
    const isSel = o.value === current;
    return (
      <button
        key={o.value}
        type="button"
        disabled={o.disabled}
        onClick={() => !o.disabled && pick(o.value)}
        className={`flex w-full items-center px-3 py-2 text-left text-sm transition ${
          isSel ? "bg-aurora-mint/15 text-white" : "text-slate-200 hover:bg-white/10"
        } ${o.disabled ? "cursor-not-allowed opacity-40" : ""}`}
      >
        {o.label || <span className="text-slate-500">—</span>}
      </button>
    );
  };

  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-required={required}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`input flex items-center justify-between gap-2 text-left ${className} ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        <span className={`truncate ${selected && selected.value ? "text-slate-100" : "text-slate-500"}`}>
          {selected ? selected.label : "Select…"}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, zIndex: 60 }}
            className="max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-aurora-bg2 py-1 shadow-2xl"
          >
            {items.map((it, i) =>
              "group" in it ? (
                <div key={`g-${i}`}>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {it.group}
                  </p>
                  {it.options.map(renderOption)}
                </div>
              ) : (
                renderOption(it)
              ),
            )}
          </div>,
          document.body,
        )}
    </label>
  );
}
