import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PaymentResultCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  orderId?: string | null;
  primaryAction: {
    label: string;
    to: string;
  };
  secondaryAction?: {
    label: string;
    to: string;
  };
}

export default function PaymentResultCard({
  icon,
  title,
  description,
  orderId,
  primaryAction,
  secondaryAction,
}: PaymentResultCardProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">{icon}</div>

        <h1 className="mb-2 text-3xl font-bold text-foreground">{title}</h1>
        <p className="mb-6 text-muted-foreground">{description}</p>

        {orderId && (
          <div className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
            Order ID: <span className="font-medium">{orderId}</span>
          </div>
        )}

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to={primaryAction.to}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {primaryAction.label}
          </Link>

          {secondaryAction && (
            <Link
              to={secondaryAction.to}
              className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-3 font-medium text-foreground transition-colors hover:bg-muted"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}