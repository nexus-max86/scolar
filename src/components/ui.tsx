import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { CURRENCIES, formatMoney, type Totals } from "@/lib/money";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="no-print mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={cx("rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const buttonStyles = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
  secondary: "border border-line bg-white text-ink hover:bg-gray-50 active:bg-gray-100",
  success: "bg-green-700 text-white hover:bg-green-800",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  ghost: "text-brand-600 hover:bg-brand-50",
};
export type ButtonVariant = keyof typeof buttonStyles;

export function buttonClass(variant: ButtonVariant = "primary", extra?: string) {
  return cx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10",
    buttonStyles[variant],
    extra,
  );
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

const inputClass =
  "block w-full min-h-11 rounded-lg border border-line bg-white px-3 text-base text-ink placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100 sm:min-h-10 sm:text-sm";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.type === "file" && "py-2", props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, "pr-8", props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cx(inputClass, "py-2", props.className)} />;
}

const badgeStyles = {
  green: "bg-green-50 text-green-800 ring-green-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  orange: "bg-amber-50 text-amber-800 ring-amber-600/20",
  gray: "bg-gray-50 text-muted ring-gray-500/20",
  blue: "bg-brand-50 text-brand-700 ring-brand-600/20",
};
export function Badge({ color = "gray", children }: { color?: keyof typeof badgeStyles; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", badgeStyles[color])}>
      {children}
    </span>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const styles = {
    info: "border-brand-200 bg-brand-50 text-brand-800",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-green-200 bg-green-50 text-green-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cx("rounded-lg border px-4 py-3 text-sm leading-relaxed", styles[kind])}>
      {children}
    </div>
  );
}

/** Tableau qui défile horizontalement sur téléphone au lieu de casser la page. */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted first:pl-4 sm:first:pl-5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {hasRows ? (
            children
          ) : (
            <tr>
              <td colSpan={head.length} className="px-4 py-10 text-center text-sm text-muted">
                {empty ?? "Aucune donnée pour le moment."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("whitespace-nowrap px-4 py-3 text-ink first:pl-4 sm:first:pl-5", className)}>{children}</td>;
}

export function StatCard({ label, value, tone = "default", hint, href }: { label: string; value: ReactNode; tone?: "default" | "green" | "red" | "orange"; hint?: ReactNode; href?: string }) {
  const tones = { default: "text-ink", green: "text-green-800", red: "text-red-700", orange: "text-amber-700" };
  const body = (
    <>
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cx("mt-1.5 text-xl font-semibold tabular-nums tracking-tight sm:text-[22px]", tones[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </>
  );
  const cls = "block rounded-[var(--radius-card)] border border-line bg-white p-4";
  return href ? <Link href={href} className={cx(cls, "transition-colors hover:border-brand-200")}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Montants par devise, une ligne par devise (évite « 7 935,00 $ + 520 000 FC » coupé en deux). */
export function MoneyLines({ totals }: { totals: Totals }) {
  const parts = CURRENCIES.filter((c) => totals[c] !== BigInt(0));
  if (parts.length === 0) return <>{formatMoney(0, "USD")}</>;
  return (
    <>
      {parts.map((c) => (
        <span key={c} className="block">{formatMoney(totals[c], c)}</span>
      ))}
    </>
  );
}

/** Logo texte de Scolar. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-tight text-ink", className)}>
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-[13px] font-bold text-white">S</span>
      <span>
        Scolar
      </span>
    </span>
  );
}
