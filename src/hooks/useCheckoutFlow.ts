import { useEffect, useMemo, useState } from "react";
import { buildCheckoutFieldErrors } from "@/lib/checkoutValidation";

export type CheckoutStep = 1 | 2 | 3;
export type ExtendedPaymentMethod = "cash" | "card" | "eft" | "voucher";

export interface CheckoutFormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  payment: ExtendedPaymentMethod;
}

interface UseCheckoutFlowParams {
  initialForm: CheckoutFormState;
  isSignedIn: boolean;
  voucherPaymentReady: boolean;
}

export function useCheckoutFlow({
  initialForm,
  isSignedIn,
  voucherPaymentReady,
}: UseCheckoutFlowParams) {
  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [form, setForm] = useState<CheckoutFormState>(initialForm);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: prev.name || initialForm.name,
      phone: prev.phone || initialForm.phone,
      email: prev.email || initialForm.email,
      address: prev.address || initialForm.address,
    }));
  }, [initialForm.address, initialForm.email, initialForm.name, initialForm.phone]);

  const update = <K extends keyof CheckoutFormState>(
    field: K,
    value: CheckoutFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const markTouched = (field: keyof CheckoutFormState) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const fieldErrors = useMemo(() => {
    return buildCheckoutFieldErrors(form, { lat: null, lng: null });
  }, [form]);

  const canContinueFromDelivery = Boolean(
    isSignedIn && !fieldErrors.name && !fieldErrors.phone && !fieldErrors.address
  );

  const canContinueFromPayment = Boolean(
    form.payment !== "voucher" || voucherPaymentReady
  );

  const handleStepChange = (targetStep: CheckoutStep) => {
    if (targetStep <= currentStep) {
      setCurrentStep(targetStep);
      return null;
    }

    if (targetStep >= 2 && !canContinueFromDelivery) {
      setTouched((prev) => ({ ...prev, name: true, phone: true, address: true }));
      return !isSignedIn
        ? "Please sign in before placing your order."
        : "Complete delivery details first.";
    }

    if (targetStep === 3 && !canContinueFromPayment) {
      return "Please complete payment setup before review.";
    }

    setCurrentStep(targetStep);
    return null;
  };

  return {
    currentStep,
    setCurrentStep,
    form,
    setForm,
    touched,
    setTouched,
    update,
    markTouched,
    fieldErrors,
    canContinueFromDelivery,
    canContinueFromPayment,
    handleStepChange,
  };
}
