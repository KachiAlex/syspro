import { ReactNode } from "react";

type ClassValue = string | false | null | undefined;

const cn = (...classes: ClassValue[]) => classes.filter(Boolean).join(" ");

interface PanelProps {
  children: ReactNode;
  className?: string;
  variant?: "frost" | "glass" | "card" | "daylight";
}

const PANEL_VARIANTS: Record<NonNullable<PanelProps["variant"]>, string> = {
  card: "rounded-3xl border border-slate-200/10 bg-slate-900/40 p-6 shadow-lg shadow-slate-950/30 backdrop-blur",
  glass: "rounded-[32px] border border-slate-200/10 bg-slate-900/30 p-6 shadow-xl shadow-slate-950/40 backdrop-blur-xl",
  frost: "rounded-[28px] border border-white/20 bg-white/10 p-6 shadow-[0_30px_60px_rgba(15,23,42,0.45)] backdrop-blur-2xl",
  daylight: "rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/10",
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
    eyebrow: "text-slate-500",
    title: "text-slate-900",
    description: "text-slate-600",
  },
  dark: {
    eyebrow: "text-slate-400",
    title: "text-white",
    description: "text-slate-400",
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
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  secondary: "border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700",
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
      <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{label}</p>
      <p className="text-3xl font-semibold text-white">{value}</p>
      {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}
