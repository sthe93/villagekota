import { CheckCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PaymentResultCard from "@/components/payment/PaymentResultCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";

async function extractFunctionErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Failed to finalize paid order.";
  }

  const edgeError = error as Error & {
    context?: {
      clone?: () => {
        json?: () => Promise<{ error?: string }>;
      };
      json?: () => Promise<{ error?: string }>;
    };
  };

  try {
    const payload =
      (await edgeError.context?.clone?.().json?.()) || (await edgeError.context?.json?.());

    if (payload?.error) {
      return payload.error;
    }
  } catch {
    // ignore parse errors and fall back to generic message
  }

  return edgeError.message || "Failed to finalize paid order.";
}

export default function PaymentSuccessPage() {
  const { user, session, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const authPromptedRef = useRef(false);
  const finalizeAttemptedRef = useRef<string | null>(null);

  const orderId = useMemo(() => searchParams.get("orderId"), [searchParams]);
  const cardSessionId = useMemo(() => searchParams.get("cardSessionId"), [searchParams]);
  const payfastReference = useMemo(
    () => searchParams.get("pf_payment_id") || searchParams.get("payment_id") || cardSessionId,
    [searchParams, cardSessionId]
  );

  useEffect(() => {
    if (orderId || !cardSessionId || !payfastReference) return;
    if (loading) return;
    if (!user || !session?.access_token) {
      if (!authPromptedRef.current) {
        toast.error("Please sign in again so we can finalize your paid order.");
        authPromptedRef.current = true;
      }
      return;
    }
    authPromptedRef.current = false;

    if (finalizeAttemptedRef.current === cardSessionId) {
      return;
    }

    const storageKey = `pending_card_order:${cardSessionId}`;
    const pendingPayloadRaw = window.localStorage.getItem(storageKey);
    if (!pendingPayloadRaw) return;

    const finalizeCardOrder = async () => {
      finalizeAttemptedRef.current = cardSessionId;
      setFinalizing(true);
      try {
        const pendingPayload = JSON.parse(pendingPayloadRaw) as Record<string, unknown>;
        const { data: createdOrder, error } = await supabase.functions.invoke("create-order", {
          body: {
            ...pendingPayload,
            paymentMethod: "card",
            cardPaymentConfirmed: true,
            cardPaymentReference: payfastReference,
          },
          headers: session?.access_token
            ? {
                Authorization: `Bearer ${session.access_token}`,
              }
            : undefined,
        });

        if (error) {
          throw new Error(error.message || "Failed to finalize paid order.");
        }

        const nextOrderId = (createdOrder as { orderId?: string } | null)?.orderId;
        if (!nextOrderId) {
          throw new Error("Payment succeeded but order finalization did not return an order id.");
        }

        window.localStorage.removeItem(storageKey);
        setCreatedOrderId(nextOrderId);
      } catch (error) {
        finalizeAttemptedRef.current = null;
        toast.error(await extractFunctionErrorMessage(error));
      } finally {
        setFinalizing(false);
      }
    };

    void finalizeCardOrder();
  }, [cardSessionId, loading, orderId, payfastReference, session?.access_token, user]);

  const resolvedOrderId = createdOrderId || orderId;

  return (
    <PaymentResultCard
      icon={<CheckCircle className="h-16 w-16 text-green-600" />}
      title={finalizing ? "Finalizing your order" : "Payment Submitted"}
      description={
        finalizing
          ? "Your payment succeeded. We are creating your order now."
          : "We received your return from PayFast and will confirm the payment on your order shortly."
      }
      orderId={resolvedOrderId}
      primaryAction={
        resolvedOrderId
          ? {
              label: "Track Order",
              to: `/order-tracking/${resolvedOrderId}`,
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
