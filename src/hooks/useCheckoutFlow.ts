import { useEffect, useMemo, useState } from "react";

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

const SOUTH_AFRICAN_PHONE_REGEX = /^0\d{9}$/;

function getPhoneDigits(value: string) {
  return value.replace(/\D/g, "");
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
    const errors: Partial<Record<keyof CheckoutFormState, string>> = {};
    const phoneDigits = getPhoneDigits(form.phone);

    if (!form.name.trim()) {
      errors.name = "Full name is required.";
    }

    if (!phoneDigits) {
      errors.phone = "Cell phone number is required.";
    } else if (!SOUTH_AFRICAN_PHONE_REGEX.test(phoneDigits)) {
      errors.phone = "Enter a valid South African cell phone number (10 digits).";
    }

    if (!form.address.trim()) {
      errors.address = "Delivery address is required.";
    }

    if (form.payment === "card" && !form.email.trim()) {
      errors.email = "Email is required for card payments.";
    }

    return errors;
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
