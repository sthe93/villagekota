import { XCircle } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PaymentResultCard from "@/components/payment/PaymentResultCard";


export default function PaymentCancelPage() {
  const [searchParams] = useSearchParams();

  const orderId = useMemo(() => searchParams.get("orderId"), [searchParams]);

  return (
    <PaymentResultCard
      icon={<XCircle className="h-16 w-16 text-orange-600" />}
      title="Payment Cancelled"
      description="Your payment was cancelled. Your order was saved, and you can try again."
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