import { ReactNode } from "react";

type ClassValue = string | false | null | undefined;

const cn = (...classes: ClassValue[]) => classes.filter(Boolean).join(" ");

interface PanelProps {
  children: ReactNode;
  className?: string;
  variant?: "frost" | "glass" | "card" | "daylight";
}

export function Panel({ children, className, variant = "card" }: PanelProps) {
  const baseStyles = {
    card: "rounded-3xl muted-border glass p-6 backdrop-blur",
    glass: "rounded-[32px] muted-border glass p-6 backdrop-blur-xl",
    frost: "rounded-[28px] muted-border glass p-6 shadow-[0_30px_60px_rgba(0,0,0,0.35)]",
    daylight: "rounded-3xl border border-slate-200 bg-[color:var(--background)] p-6 shadow-lg shadow-slate-900/5",
  };

  return <div className={cn(baseStyles[variant], className)}>{children}</div>;
}

const TAG_TONES = {
  teal: "text-[#64ffd6] bg-[#64ffd6]/10",
  amber: "text-[#ffd36b] bg-[#ffd36b]/10",
  rose: "text-[#ff8aa1] bg-[#ff8aa1]/10",
  indigo: "text-[#8fb0ff] bg-[#8fb0ff]/10",
} as const;

type TagTone = keyof typeof TAG_TONES;

interface TagProps {
  children: ReactNode;
  tone?: TagTone;
}

export function Tag({ children, tone = "teal" }: TagProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs uppercase tracking-[0.35em]", TAG_TONES[tone])}>
      {children}
    </span>
  );
}

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  tone?: "light" | "dark";
}

export function SectionHeading({ eyebrow, title, description, tone = "light" }: SectionHeadingProps) {
  const toneClasses =
    tone === "dark"
      ? {
          eyebrow: "text-muted",
          title: "text-[color:var(--foreground)]",
          description: "text-muted",
        }
      : {
          eyebrow: "text-muted",
          title: "text-[color:var(--foreground)]",
          description: "text-muted",
        };

  return (
    <div>
      <p className={cn("text-xs uppercase tracking-[0.4em]", toneClasses.eyebrow)}>{eyebrow}</p>
      <h2 className={cn("mt-2 text-2xl font-semibold", toneClasses.title)}>{title}</h2>
      {description ? <p className={cn("mt-1 text-sm", toneClasses.description)}>{description}</p> : null}
    </div>
  );
}

type PillButtonVariant = "primary" | "secondary";

interface PillButtonProps {
  children: ReactNode;
  variant?: PillButtonVariant;
}

export function PillButton({ children, variant = "secondary" }: PillButtonProps) {
  const variants: Record<PillButtonVariant, string> = {
    primary: "bg-[color:var(--foreground)] text-[color:var(--background)] hover:opacity-95",
    secondary: "border muted-border nav-muted hover:border-[color:var(--foreground)] hover:text-[color:var(--foreground)]",
  };

  return (
    <button className={cn("group flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition", variants[variant])}>
      {children}
    </button>
  );
}

interface MetricStatProps {
  label: string;
  value: string;
  helper?: string;
}

export function MetricStat({ label, value, helper }: MetricStatProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.35em] text-muted">{label}</p>
      <p className="text-3xl font-semibold text-[color:var(--foreground)]">{value}</p>
      {helper ? <p className="text-xs text-muted">{helper}</p> : null}
    </div>
  );
}
