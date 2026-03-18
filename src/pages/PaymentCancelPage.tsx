import { XCircle } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function PaymentCancelPage() {
  const [searchParams] = useSearchParams();

  const orderId = useMemo(() => searchParams.get("orderId"), [searchParams]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-sm p-8 text-center">
        <XCircle className="w-16 h-16 mx-auto text-orange-600 mb-4" />
        <h1 className="text-3xl font-bold text-foreground mb-2">Payment Cancelled</h1>
        <p className="text-muted-foreground mb-6">
          Your payment was cancelled. Your order was saved, and you can try again.
        </p>

        {orderId && (
          <div className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
            Order ID: <span className="font-medium">{orderId}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {orderId ? (
            <Link
              to={`/order-tracking/${orderId}`}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              View Order
            </Link>
          ) : (
            <Link
              to="/checkout"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Back to Checkout
            </Link>
          )}

          <Link
            to="/menu"
            className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-3 text-foreground font-medium hover:bg-muted transition-colors"
          >
            Back to Menu
          </Link>
        </div>
      </div>
    </div>
  );
}