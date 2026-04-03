import { XCircle } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PaymentResultCard from "@/components/payment/PaymentResultCard";


export default function PaymentCancelPage() {
  const [searchParams] = useSearchParams();

  const orderId = useMemo(() => searchParams.get("orderId"), [searchParams]);
  const cardSessionId = useMemo(() => searchParams.get("cardSessionId"), [searchParams]);

  useEffect(() => {
    if (!cardSessionId) return;
    window.localStorage.removeItem(`pending_card_order:${cardSessionId}`);
  }, [cardSessionId]);

  return (
    <PaymentResultCard
      icon={<XCircle className="h-16 w-16 text-orange-600" />}
      title="Payment Cancelled"
      description="Your payment was cancelled. No card order was created."
      orderId={orderId}
      primaryAction={
        orderId
          ? {
              label: "View Order",
              to: `/order-tracking/${orderId}`,
            }
          : {
              label: "Back to Checkout",
              to: "/checkout",
            }
      }
      secondaryAction={{
        label: "Back to Menu",
        to: "/menu",
      }}
    />
  );
}
