import { ReactNode } from "react";

type ClassValue = string | false | null | undefined;

const cn = (...classes: ClassValue[]) => classes.filter(Boolean).join(" ");

interface PanelProps {
  children: ReactNode;
  className?: string;
  variant?: "frost" | "glass" | "card" | "daylight";
}

const PANEL_VARIANTS: Record<NonNullable<PanelProps["variant"]>, string> = {
  card: "rounded-3xl border border-theme-border/10 bg-theme-surface/40 p-6 shadow-lg shadow-slate-950/30 backdrop-blur",
  glass: "rounded-[32px] border border-theme-border/10 bg-theme-surface/30 p-6 shadow-xl shadow-slate-950/40 backdrop-blur-xl",
  frost: "rounded-[28px] border border-white/20 bg-theme-surface/10 p-6 shadow-[0_30px_60px_rgba(15,23,42,0.45)] backdrop-blur-2xl",
  daylight: "rounded-3xl border border-theme-border bg-theme-surface p-6 shadow-lg shadow-slate-900/10",
};

export function Panel({ children, className, variant = "card" }: PanelProps) {
  return <div className={cn(PANEL_VARIANTS[variant], className)}>{children}</div>;
}

const TAG_TONES = {
  teal: "text-teal-200 bg-teal-400/10",
  amber: "text-amber-200 bg-amber-400/10",
  rose: "text-rose-200 bg-rose-400/10",
  indigo: "text-indigo-200 bg-indigo-400/10",
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

const SECTION_TONES = {
  light: {
    eyebrow: "text-theme-text-tertiary",
    title: "text-theme-text-primary",
    description: "text-theme-text-secondary",
  },
  dark: {
    eyebrow: "text-theme-text-secondary",
    title: "text-white",
    description: "text-theme-text-secondary",
  },
} satisfies Record<NonNullable<SectionHeadingProps["tone"]>, Record<"eyebrow" | "title" | "description", string>>;

export function SectionHeading({ eyebrow, title, description, tone = "light" }: SectionHeadingProps) {
  const toneClasses = SECTION_TONES[tone];

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

const PILL_VARIANTS: Record<PillButtonVariant, string> = {
  primary: "bg-theme-surface text-theme-text-primary hover:bg-theme-muted",
  secondary: "border border-theme-border text-theme-text-tertiary hover:border-theme-border hover:text-theme-text-primary",
};

export function PillButton({ children, variant = "secondary" }: PillButtonProps) {
  return (
    <button className={cn("group flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition", PILL_VARIANTS[variant])}>
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
      <p className="text-xs uppercase tracking-[0.35em] text-theme-text-secondary">{label}</p>
      <p className="text-3xl font-semibold text-white">{value}</p>
      {helper ? <p className="text-xs text-theme-text-tertiary">{helper}</p> : null}
    </div>
  );
}
