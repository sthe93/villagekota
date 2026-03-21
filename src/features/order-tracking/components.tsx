import type { LucideIcon } from "lucide-react";
import { cn, formatCurrency, getOrderStatusBadgeTone, getStatusLabel } from "./utils";
import type { OrderStatus } from "./types";

export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[28px] border border-border bg-card shadow-card", className)}>
      <div className="border-b border-border bg-muted/30 px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>

          {action}
        </div>
      </div>

      <div className={cn("p-5 md:p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[22px] border border-border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 truncate text-base font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export function InfoTile({
  label,
  value,
  subValue,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  icon?: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <div className={cn("mt-2 text-base font-semibold", accent ? "text-primary" : "text-foreground")}>
            {value}
          </div>
          {subValue ? <div className="mt-1 text-xs text-muted-foreground">{subValue}</div> : null}
        </div>

        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PaymentStatusBadge({
  hasPaymentMismatch,
  paymentIsPaid,
  isEftPayment,
  isCashPayment,
  isDelivered,
  cashCollected,
  isArrived,
  paymentIsPending,
  paymentIsFailed,
}: {
  hasPaymentMismatch: boolean;
  paymentIsPaid: boolean;
  isEftPayment: boolean;
  isCashPayment: boolean;
  isDelivered: boolean;
  cashCollected: boolean;
  isArrived: boolean;
  paymentIsPending: boolean;
  paymentIsFailed: boolean;
}) {
  if (hasPaymentMismatch) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700">
        Payment mismatch
      </div>
    );
  }

  if (paymentIsPaid) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
        {isEftPayment ? "EFT confirmed" : "Paid"}
      </div>
    );
  }

  if (isCashPayment && isDelivered && cashCollected) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
        Cash collected
      </div>
    );
  }

  if (isCashPayment && isArrived && !cashCollected) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
        Cash due now
      </div>
    );
  }

  if (isCashPayment) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
        Cash on delivery
      </div>
    );
  }

  if (isEftPayment && paymentIsPending) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
        EFT pending
      </div>
    );
  }

  if (paymentIsFailed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700">
        Payment failed
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
      Payment pending
    </div>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <div
      className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-medium ${
        getOrderStatusBadgeTone(status) || "border-border bg-muted text-foreground"
      }`}
    >
      {getStatusLabel(status)}
    </div>
  );
}

export function OrderTotalsCard({
  subtotal,
  deliveryFee,
  discountAmount,
  total,
}: {
  subtotal: number | null | undefined;
  deliveryFee: number | null | undefined;
  discountAmount: number | null | undefined;
  total: number | null | undefined;
}) {
  return (
    <div className="rounded-[22px] border border-border bg-muted/25 p-4">
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Delivery fee</span>
          <span className="font-medium text-foreground">{formatCurrency(deliveryFee)}</span>
        </div>

        {!!Number(discountAmount || 0) && (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
            <span className="font-medium">Discount</span>
            <span className="font-semibold">-{formatCurrency(discountAmount)}</span>
          </div>
        )}

        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-foreground">Total</span>
            <span className="text-xl font-semibold text-primary">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
