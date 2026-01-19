import { ReactNode } from "react";

type ClassValue = string | false | null | undefined;

const cn = (...classes: ClassValue[]) => classes.filter(Boolean).join(" ");

interface PanelProps {
  children: ReactNode;
  className?: string;
  variant?: "frost" | "glass" | "card";
}

export function Panel({ children, className, variant = "card" }: PanelProps) {
  const baseStyles = {
    card: "rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur",
    glass:
      "rounded-[32px] border border-white/15 bg-gradient-to-br from-white/10 to-white/5 p-6 backdrop-blur-xl",
    frost:
      "rounded-[28px] border border-white/5 bg-black/20 p-6 shadow-[0_30px_60px_rgba(0,0,0,0.35)]",
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
}

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.4em] text-white/50">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
      {description ? <p className="mt-2 text-sm text-white/60">{description}</p> : null}
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
    primary: "bg-white text-[#05060a] hover:bg-white/90",
    secondary: "border border-white/20 text-white/80 hover:border-white hover:text-white",
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
      <p className="text-xs uppercase tracking-[0.35em] text-white/50">{label}</p>
      <p className="text-3xl font-semibold text-white">{value}</p>
      {helper ? <p className="text-xs text-white/60">{helper}</p> : null}
    </div>
  );
}
