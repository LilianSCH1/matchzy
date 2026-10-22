// Petits contrôles de formulaire partagés (sans état, utilisables dans les composants clients).
import { IconMinus, IconPlus } from "./Icons";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Switch({ label, hint, checked, onChange, className = "" }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-4 py-1.5 ${className}`}>
      <span>
        <span className="block text-[15px] font-semibold">{label}</span>
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-md bg-line-strong shadow-[inset_0_1px_3px_rgb(0_0_0/0.25)] transition peer-checked:bg-accent peer-focus-visible:ring-4 peer-focus-visible:ring-accent/20" />
        <span className="absolute top-1 left-1 size-5 rounded-[4px] bg-surface shadow-[inset_0_-2px_0_rgb(0_0_0/0.2)] transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Stepper({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <div className="flex h-11 items-center rounded-md border border-line-strong bg-surface">
      <button type="button" className="btn-icon ml-1 size-9" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Moins">
        <IconMinus className="size-4" />
      </button>
      <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          style={{ width: `${Math.max(1, String(value).length) + 0.6}ch` }}
          className="min-w-0 bg-transparent text-center font-cond text-lg font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
        />
        {suffix && <span className="pointer-events-none text-xs text-ink-3">{suffix}</span>}
      </div>
      <button type="button" className="btn-icon mr-1 size-9" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="Plus">
        <IconPlus className="size-4" />
      </button>
    </div>
  );
}

export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  full,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  full?: boolean;
}) {
  return (
    <div className={`seg ${full ? "flex w-full" : ""}`}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" onClick={() => onChange(o.value)} className={`seg-item ${full ? "flex-1" : ""} ${o.value === value ? "seg-on" : ""}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="flex items-center gap-3 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">
      <span aria-hidden className="h-6 w-4 shrink-0 -rotate-6 rounded-[3px] bg-danger shadow-sm" />
      {children}
    </p>;
}
