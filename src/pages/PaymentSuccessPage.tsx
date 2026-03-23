import { CheckCircle } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PaymentResultCard from "@/components/payment/PaymentResultCard";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();

  const orderId = useMemo(() => searchParams.get("orderId"), [searchParams]);

  return (
    <PaymentResultCard
      icon={<CheckCircle className="h-16 w-16 text-green-600" />}
      title="Payment Submitted"
      description="We received your return from PayFast and will confirm the payment on your order shortly."
      orderId={orderId}
      primaryAction={
        orderId
          ? {
              label: "Track Order",
              to: `/order-tracking/${orderId}`,
            }
          : {
              label: "Go to Account",
              to: "/account",
            }
      }
      secondaryAction={{
        label: "Back to Menu",
        to: "/menu",
      }}
    />
  );
}
