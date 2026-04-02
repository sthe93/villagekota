import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatSupabaseError } from "@/lib/supabaseSchemaCompatibility";
import { toast } from "@/components/ui/sonner";
import { Link, useNavigate } from "react-router-dom";
import {
  Tag,
  Loader2,
  CreditCard,
  Banknote,
  Landmark,
  ShieldCheck,
  Clock3,
  ImageOff,
  CheckCircle2,
  BookmarkPlus,
  Home,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Footer from "@/components/Footer";
import {
  geocodeSouthAfricaAddress,
} from "@/lib/maps";
import {
  useCheckoutFlow,
  type ExtendedPaymentMethod,
  type CheckoutStep,
} from "@/hooks/useCheckoutFlow";
import {
  findDuplicateSavedAddress,
  normalizeSavedAddressLabel,
  normalizeSavedAddressText,
  sortSavedAddresses,
  type SavedAddressRecord,
} from "@/lib/savedAddresses";
import { trackEvent } from "@/lib/analytics";
import {
  isStarVillageAddress,
  isWithinStarVillageGeofence,
  STAR_VILLAGE_DELIVERY_MESSAGE,
} from "@/lib/deliveryZone";
import {
  buildCheckoutFieldErrors,
  buildCheckoutValidationMessages,
  getPhoneDigits,
} from "@/lib/checkoutValidation";

const AddressAutocompleteField = lazy(() => import("@/components/AddressAutocompleteField"));

type PaymentMethod = "cash" | "card" | "eft";
type VoucherProvider = "one_voucher" | "ott_voucher" | "blu_voucher" | "instant_money";
type VoucherSource = "local" | "provider";

interface VoucherInfo {
  id: string | null;
  code: string;
  type: string;
  source: VoucherSource;
  provider: VoucherProvider | null;
  providerReference: string | null;
  value: number;
  balance: number;
  usedCount: number;
  discountAmount: number;
}

interface CreateOrderResponse {
  orderId: string;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  total: number;
  paymentStatus: string | null;
  paymentProvider: string | null;
  paymentReference: string | null;
  voucherCode: string | null;
}

const priceFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const VOUCHER_PROVIDER_LABELS: Record<VoucherProvider, string> = {
  one_voucher: "1Voucher",
  ott_voucher: "OTT Voucher",
  blu_voucher: "Blu Voucher",
  instant_money: "Instant Money",
};

const ONE_VOUCHER_PIN_REGEX = /^\d{16}$/;

export default function CheckoutPage() {
  const {
    items,
    subtotal,
    deliveryFee,
    total,
    clearCart,
    freeDeliveryRemaining,
    freeDeliveryThreshold,
    qualifiesForFreeDelivery,
  } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const checkoutFormRef = useRef<HTMLFormElement | null>(null);
  const signInButtonRef = useRef<HTMLButtonElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const addressInputRef = useRef<HTMLTextAreaElement | null>(null);
  const voucherInputRef = useRef<HTMLInputElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherInfo, setVoucherInfo] = useState<VoucherInfo | null>(null);
  const [applyingVoucher, setApplyingVoucher] = useState(false);

  const [savedAddresses, setSavedAddresses] = useState<SavedAddressRecord[]>([]);
  const [loadingSavedAddresses, setLoadingSavedAddresses] = useState(true);
  const [savingCurrentAddress, setSavingCurrentAddress] = useState(false);
  const [newSavedAddressLabel, setNewSavedAddressLabel] = useState("");
  const [showSavedAddresses, setShowSavedAddresses] = useState(false);
  const [showVoucherSummary, setShowVoucherSummary] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<{
    lat: number | null;
    lng: number | null;
  }>({
    lat: null,
    lng: null,
  });
  const voucherPaymentAllowed = Boolean(voucherInfo && voucherInfo.type === "prepaid");
  const {
    currentStep: checkoutStep,
    setCurrentStep: setCheckoutStep,
    form,
    setForm,
    touched,
    setTouched,
    update,
    markTouched: markCheckoutTouched,
    fieldErrors: checkoutFieldErrors,
    canContinueFromDelivery: canContinueDeliveryStep,
    canContinueFromPayment: canContinuePaymentStep,
    handleStepChange: handleCheckoutStepChange,
  } = useCheckoutFlow({
    initialForm: {
      name: profile?.display_name || "",
      phone: profile?.phone || "",
      email: user?.email || "",
      address: profile?.default_address || "",
      notes: "",
      payment: "cash",
    },
    isSignedIn: Boolean(user),
    voucherPaymentReady: voucherPaymentAllowed,
  });

  const refreshSavedAddresses = useCallback(async () => {
    if (!user) {
      setSavedAddresses([]);
      setLoadingSavedAddresses(false);
      return;
    }

    const { data, error } = await supabase
      .from("saved_addresses")
      .select("id, label, address_text, destination_lat, destination_lng, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) throw error;
    setSavedAddresses(sortSavedAddresses((data as SavedAddressRecord[]) || []));
  }, [user]);

  useEffect(() => {
    let active = true;

    const loadSavedAddresses = async () => {
      setLoadingSavedAddresses(true);

      try {
        await refreshSavedAddresses();
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Failed to load saved addresses");
          setSavedAddresses([]);
        }
      } finally {
        if (active) {
          setLoadingSavedAddresses(false);
        }
      }
    };

    void loadSavedAddresses();

    return () => {
      active = false;
    };
  }, [refreshSavedAddresses]);

  const updateField = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    update(field, value);

    if (field === "address") {
      setSelectedDestination({ lat: null, lng: null });
    }
  };

  const markTouched = (field: keyof typeof form) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const focusAndRevealField = (element: HTMLElement | null) => {
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      element.focus({ preventScroll: true });
    }, 120);
  };

  const focusFirstInvalidForDelivery = () => {
    if (!user) {
      focusAndRevealField(signInButtonRef.current);
      return;
    }

    if (checkoutFieldErrors.name) {
      focusAndRevealField(nameInputRef.current);
      return;
    }

    if (checkoutFieldErrors.phone) {
      focusAndRevealField(phoneInputRef.current);
      return;
    }

    if (checkoutFieldErrors.address) {
      focusAndRevealField(addressInputRef.current);
      return;
    }
  };

  const focusFirstInvalidForPayment = () => {
    if (form.payment === "voucher" && !canContinuePaymentStep) {
      focusAndRevealField(voucherInputRef.current);
    }
  };

  const applySavedAddress = (address: SavedAddressRecord) => {
    updateField("address", address.address_text);
    setSelectedDestination({
      lat: address.destination_lat,
      lng: address.destination_lng,
    });
    toast.success(`${address.label} added to checkout.`);
  };

  const getCheckoutValidationMessages = () => {
    return buildCheckoutValidationMessages({
      isSignedIn: Boolean(user),
      fields: form,
      destination: selectedDestination,
    });
  };

  const discountAmount = voucherInfo?.discountAmount || 0;
  const adjustedTotal = Math.max(0, total - discountAmount);
  const prepaidVoucherApplied = voucherInfo?.type === "prepaid";
  const voucherProviderLabel =
    voucherInfo?.provider ? VOUCHER_PROVIDER_LABELS[voucherInfo.provider] : "Prepaid voucher";
  const voucherCoversFullOrder = prepaidVoucherApplied && adjustedTotal === 0;
  const addressConfidence = useMemo(() => {
    if (selectedDestination.lat != null && selectedDestination.lng != null) {
      return {
        label: "Exact pin found",
        tone: "bg-success/10 text-success",
      };
    }

    if (form.address.trim().length >= 12) {
      return {
        label: "Approximate match",
        tone: "bg-accent/20 text-accent-foreground",
      };
    }

    return {
      label: "Needs confirmation",
      tone: "bg-muted text-muted-foreground",
    };
  }, [form.address, selectedDestination.lat, selectedDestination.lng]);
  const selectedPaymentLabel =
    form.payment === "voucher"
      ? voucherProviderLabel
      : paymentOptionsLabel(form.payment);
  const deliveryProgress =
    items.length === 0
      ? 0
      : Math.min((subtotal / freeDeliveryThreshold) * 100, 100);

  const fieldErrors = useMemo(() => {
    return buildCheckoutFieldErrors(form, selectedDestination);
  }, [form, selectedDestination.lat, selectedDestination.lng]);

  const canContinueFromDelivery = Boolean(
    user && !fieldErrors.name && !fieldErrors.phone && !fieldErrors.address
  );

  const canContinueFromPayment = Boolean(
    form.payment !== "voucher" || (voucherInfo && voucherInfo.type === "prepaid")
  );

  const handleStepChange = (targetStep: CheckoutStep) => {
    if (targetStep <= currentStep) {
      setCurrentStep(targetStep);
      return;
    }

    if (targetStep >= 2 && !canContinueFromDelivery) {
      setTouched((prev) => ({ ...prev, name: true, phone: true, address: true }));
      toast.error(!user ? "Please sign in before placing your order." : "Complete delivery details first.");
      return;
    }

    if (targetStep === 3 && !canContinueFromPayment) {
      toast.error("Please complete payment setup before review.");
      return;
    }

    setCurrentStep(targetStep);
  };

  const orderButtonLabel = useMemo(() => {
    if (submitting) return "Placing Order...";
    if (form.payment === "card") return "Continue to PayFast";
    if (form.payment === "eft") return "Place EFT order";
    if (form.payment === "voucher") {
      return voucherCoversFullOrder ? `Place ${voucherProviderLabel} order` : "Choose backup payment method";
    }
    return "Place order";
  }, [submitting, form.payment, voucherCoversFullOrder, voucherProviderLabel]);

  const handleSaveCurrentAddress = async () => {
    if (!user) {
      toast.error("Please sign in to save addresses.");
      return;
    }

    const label = normalizeSavedAddressLabel(newSavedAddressLabel);
    const addressText = normalizeSavedAddressText(form.address);

    if (!label || !addressText) {
      toast.error("Add a label and a delivery address before saving.");
      return;
    }

    if (!isStarVillageAddress(addressText)) {
      toast.error(STAR_VILLAGE_DELIVERY_MESSAGE);
      return;
    }

    if (findDuplicateSavedAddress(savedAddresses, addressText)) {
      toast.error("That delivery address is already saved.");
      return;
    }

    setSavingCurrentAddress(true);

    try {
      let destination = selectedDestination;

      if (destination.lat == null || destination.lng == null) {
        destination = await geocodeSouthAfricaAddress(addressText);
      }

      const existingDefault = savedAddresses.find((address) => address.is_default);
      const shouldSetDefault = !existingDefault;

      const { error } = await supabase.from("saved_addresses").insert({
        user_id: user.id,
        label,
        address_text: addressText,
        destination_lat: destination?.lat ?? null,
        destination_lng: destination?.lng ?? null,
        is_default: shouldSetDefault,
      });

      if (error) throw error;

      if (shouldSetDefault) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ default_address: addressText })
          .eq("user_id", user.id);

        if (profileError) throw profileError;
      }

      setSelectedDestination({
        lat: destination?.lat ?? null,
        lng: destination?.lng ?? null,
      });
      setNewSavedAddressLabel("");
      await refreshSavedAddresses();
      toast.success("Address saved for faster checkout.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save this address");
    } finally {
      setSavingCurrentAddress(false);
    }
  };

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;

    setApplyingVoucher(true);

    try {
      const normalizedCode = voucherCode.trim().toUpperCase();
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .eq("code", normalizedCode)
        .eq("is_active", true)
        .single();

      if (error || !data) {
        if (!ONE_VOUCHER_PIN_REGEX.test(normalizedCode)) {
          toast.error("Invalid voucher code");
          return;
        }

        if (!user) {
          toast.error("Please sign in before validating a 1Voucher PIN.");
          return;
        }

        const { data: providerData, error: providerError } = await supabase.functions.invoke(
          "onevoucher-voucher",
          {
            body: {
              action: "validate",
              code: normalizedCode,
              currency: "ZAR",
              customerEmail: form.email.trim() || user.email || null,
              customerPhone: getPhoneDigits(form.phone) || profile?.phone || null,
            },
          }
        );

        if (providerError || !providerData?.success) {
          throw new Error(providerData?.message || providerError?.message || "1Voucher validation failed");
        }

        const providerBalance = Number(providerData.balance || 0);
        const discountValue = Math.min(providerBalance, total);

        if (discountValue <= 0) {
          toast.error("This 1Voucher PIN has no available balance.");
          return;
        }

        setVoucherInfo({
          id: null,
          code: normalizedCode,
          type: "prepaid",
          source: "provider",
          provider: "one_voucher",
          providerReference: providerData.providerReference || null,
          value: providerBalance,
          balance: providerBalance,
          usedCount: 0,
          discountAmount: discountValue,
        });

        setForm((prev) => ({
          ...prev,
          payment:
            prev.payment === "cash" || prev.payment === "voucher" ? "voucher" : prev.payment,
        }));

        toast.success(`1Voucher applied: -${priceFormatter.format(discountValue)}`);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        toast.error("This voucher has expired");
        return;
      }

      if (data.max_uses && data.used_count >= data.max_uses) {
        toast.error("This voucher has been fully redeemed");
        return;
      }

      if (data.min_order && subtotal < Number(data.min_order)) {
        toast.error(`Minimum order of ${priceFormatter.format(Number(data.min_order))} required`);
        return;
      }

      let disc = 0;

      if (data.type === "discount_percentage") {
        disc = Math.round(subtotal * (Number(data.value) / 100));
      } else if (data.type === "discount_fixed") {
        disc = Math.min(Number(data.value), total);
      } else if (data.type === "prepaid") {
        disc = Math.min(Number(data.balance), total);
      }

      setVoucherInfo({
        id: data.id,
        code: data.code,
        type: data.type,
        source: "local",
        provider: (data.provider as VoucherProvider | null) ?? null,
        providerReference: null,
        value: Number(data.value),
        balance: Number(data.balance || 0),
        usedCount: Number(data.used_count || 0),
        discountAmount: disc,
      });

      if (data.type === "prepaid" && Number(data.balance || 0) > 0) {
        setForm((prev) => ({
          ...prev,
          payment:
            prev.payment === "cash" || prev.payment === "voucher" ? "voucher" : prev.payment,
        }));
      }

      toast.success(`Voucher applied: -${priceFormatter.format(disc)}`);
    } catch {
      toast.error("Failed to apply voucher");
    } finally {
      setApplyingVoucher(false);
    }
  };

  const removeVoucher = () => {
    setVoucherInfo(null);
    setVoucherCode("");
    setForm((prev) => ({
      ...prev,
      payment: prev.payment === "voucher" ? "cash" : prev.payment,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    const validationMessages = getCheckoutValidationMessages();
    if (validationMessages.length > 0) {
      toast.error("Unable to place order", {
        description: validationMessages.join(" • "),
      });
      return;
    }

    if (!user) return;

    const customerEmail = form.email.trim() || user.email || "";
    const customerPhone = getPhoneDigits(form.phone);

    if (form.payment === "card" && !customerEmail) {
      toast.error("Email is required for card payments.");
      return;
    }

    if (form.payment === "voucher") {
      if (!voucherInfo || voucherInfo.type !== "prepaid") {
        toast.error("Apply a valid prepaid voucher before choosing voucher payment.");
        return;
      }

      if (!voucherCoversFullOrder) {
        toast.error(
          "This prepaid voucher does not cover the full order total yet. Use card, EFT, or cash for the remaining balance."
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const destination =
        selectedDestination.lat != null && selectedDestination.lng != null
          ? selectedDestination
          : await geocodeSouthAfricaAddress(form.address);

      if (destination?.lat == null || destination?.lng == null) {
        toast.error(
          "Please choose a suggested address inside Star Village so we can verify your delivery location."
        );
        return;
      }

      const createOrderPayload = {
        customerName: form.name.trim(),
        customerPhone,
        customerEmail: customerEmail || null,
        deliveryAddress: form.address.trim(),
        destinationLat: destination?.lat ?? null,
        destinationLng: destination?.lng ?? null,
        notes: form.notes.trim() || null,
        paymentMethod: form.payment,
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          note: item.note?.trim() || null,
          selectedOptions: item.selectedOptions.map((option) => ({
            groupId: option.groupId,
            itemId: option.itemId,
          })),
        })),
        voucherCode: voucherInfo?.code || null,
        voucherSource: voucherInfo?.source || null,
        voucherProvider: voucherInfo?.provider || null,
      };

      if (form.payment === "card") {
        const cardSessionId = crypto.randomUUID();
        window.localStorage.setItem(
          `pending_card_order:${cardSessionId}`,
          JSON.stringify({ ...createOrderPayload, paymentMethod: "card" })
        );

        const { data: payfastData, error: payfastError } = await supabase.functions.invoke(
          "create-payfast-checkout",
          {
            body: {
              cardSessionId,
              draftAmount: adjustedTotal,
              customerName: form.name.trim(),
              customerEmail,
            },
          }
        );

        if (payfastError || !payfastData?.url) {
          window.localStorage.removeItem(`pending_card_order:${cardSessionId}`);
          toast.error(
            `Failed to start payment: ${payfastError?.message || "No payment URL returned"}`
          );
          return;
        }

        window.location.href = payfastData.url;
        return;
      }

      const { data: createdOrder, error: createOrderError } = await supabase.functions.invoke(
        "create-order",
        {
          body: createOrderPayload,
        }
      );

      if (createOrderError) {
        throw new Error(createOrderError.message || "Failed to create order");
      }

      const order = createdOrder as CreateOrderResponse | null;

      if (!order?.orderId) {
        throw new Error("Order creation completed but no order id was returned.");
      }

      if (form.payment === "eft") {
        clearCart();
        toast.success("Order placed. Please complete your EFT payment and keep your order reference.");
        navigate(`/order-tracking/${order.orderId}`);
        return;
      }

      if (form.payment === "voucher") {
        clearCart();
        toast.success(`${voucherProviderLabel} accepted. Order placed and marked as paid.`);
        navigate(`/order-tracking/${order.orderId}`);
        return;
      }

      clearCart();
      toast.success("Order placed successfully.");
      navigate(`/order-tracking/${order.orderId}`);
    } catch (err: unknown) {
      toast.error(formatSupabaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const paymentOptions: Array<{
    value: ExtendedPaymentMethod;
    label: string;
    description: string;
    icon: typeof Banknote;
    disabled?: boolean;
  }> = [
    {
      value: "cash",
      label: "Cash on delivery",
      description: "Pay when your order arrives.",
      icon: Banknote,
    },
    {
      value: "card",
      label: "Card / PayFast",
      description: "Secure online payment via PayFast.",
      icon: CreditCard,
    },
    {
      value: "eft",
      label: "EFT",
      description: "Manual bank transfer after placing the order.",
      icon: Landmark,
    },
    {
      value: "voucher",
      label: voucherInfo?.provider ? voucherProviderLabel : "Prepaid voucher",
      description: prepaidVoucherApplied
        ? voucherCoversFullOrder
          ? "Use your prepaid voucher as the payment method for this order."
          : "Voucher value applied, but another method is still needed for the remaining balance."
        : "Apply a 1Voucher, OTT Voucher, Blu Voucher, or Instant Money prepaid voucher first.",
      icon: Tag,
      disabled: !prepaidVoucherApplied,
    },
  ];

  const paymentClarity = (() => {
    if (form.payment === "card") {
      return {
        title: "Secure online payment",
        description: "You’ll be redirected to PayFast now. A valid email is required.",
        tone: "border-border bg-background text-muted-foreground",
      };
    }

    if (form.payment === "eft") {
      return {
        title: "Bank transfer payment",
        description:
          "Place order now, then complete EFT transfer. Fulfilment should continue once payment is confirmed.",
        tone: "border-border bg-background text-muted-foreground",
      };
    }

    if (form.payment === "voucher") {
      return {
        title: "Voucher applied",
        description: voucherCoversFullOrder
          ? `${voucherProviderLabel} will fully cover this order.`
          : `${voucherProviderLabel} is applied, and a backup payment method is still required for the balance.`,
        tone: "border-success/30 bg-success/10 text-success",
      };
    }

    return {
      title: "Pay on delivery",
      description: "Pay cash to your driver when the order arrives.",
      tone: "border-border bg-background text-muted-foreground",
    };
  })();

  function paymentOptionsLabel(method: PaymentMethod) {
    switch (method) {
      case "card":
        return "Card / PayFast";
      case "eft":
        return "EFT";
      default:
        return "Cash on delivery";
    }
  }

  const checkoutStepMicrocopy =
    checkoutStep === 1
      ? "Step 1 of 3 · Delivery details"
      : checkoutStep === 2
        ? "Step 2 of 3 · Payment setup"
        : "Step 3 of 3 · Review and place order";

  useEffect(() => {
    trackEvent("checkout_step_viewed", {
      step: checkoutStep,
      payment_method: form.payment,
      has_voucher: Boolean(voucherInfo),
    });
  }, [checkoutStep, form.payment, voucherInfo]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl py-8 md:py-10">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Secure checkout · Live order tracking
          </div>

          <h1 className="font-display text-4xl text-foreground sm:text-5xl md:text-6xl">
            Checkout
          </h1>

          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            3-step checkout: Delivery, Payment, then Review & Place.
          </p>
        </div>

        {!user && (
          <div className="mx-auto mb-6 max-w-2xl rounded-2xl border border-accent/30 bg-accent/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">Sign in to place your order</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your details and tracking will be linked to your account.
                </p>
              </div>

              <button
                ref={signInButtonRef}
                onClick={() => navigate("/auth")}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-[28px] border border-border bg-card p-10 text-center shadow-card">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Tag className="h-8 w-8" />
            </div>
            <p className="mt-5 text-xl font-semibold text-foreground">Your cart is empty</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Add something delicious before heading to checkout.
            </p>
            <button
              onClick={() => navigate("/menu")}
              className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <form ref={checkoutFormRef} onSubmit={handleSubmit} className="space-y-5 pb-[240px] md:pb-44">
              <section className="rounded-[24px] border border-border bg-card p-4 shadow-card">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { step: 1 as CheckoutStep, label: "Delivery" },
                    { step: 2 as CheckoutStep, label: "Payment" },
                    { step: 3 as CheckoutStep, label: "Review & Place" },
                  ].map((item) => (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => {
                        const error = handleCheckoutStepChange(item.step);
                        if (!error) return;

                        if (item.step === 3 && !canContinuePaymentStep) {
                          focusFirstInvalidForPayment();
                        } else if (item.step >= 2) {
                          focusFirstInvalidForDelivery();
                        }

                        toast.error(error);
                      }}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                        checkoutStep === item.step
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-center text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  {checkoutStepMicrocopy}
                </p>
              </section>

              {checkoutStep === 1 && (
                <>
              <section className="rounded-[28px] border border-border bg-card p-5 shadow-card md:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-2xl text-foreground">Customer Details</h2>
                    <p className="text-sm text-muted-foreground">
                      We’ll use these details for delivery and updates.
                    </p>
                  </div>

                  {user && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Signed in
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Full Name *
                    </label>
                    <input
                      ref={nameInputRef}
                      id="checkout-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      onBlur={() => markCheckoutTouched("name")}
                      className={`w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary ${
                        touched.name && checkoutFieldErrors.name
                          ? "border-destructive focus:border-destructive"
                          : "border-border"
                      }`}
                      required
                    />
                    {touched.name && checkoutFieldErrors.name && (
                      <p className="mt-1 text-xs text-destructive">{checkoutFieldErrors.name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Phone *
                      </label>
                      <input
                        ref={phoneInputRef}
                        id="checkout-phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        onBlur={() => markCheckoutTouched("phone")}
                        placeholder="0XXXXXXXXX"
                        inputMode="numeric"
                        className={`w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary ${
                          touched.phone && checkoutFieldErrors.phone
                            ? "border-destructive focus:border-destructive"
                            : "border-border"
                        }`}
                        required
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        South African cell phone numbers should be 10 digits.
                      </p>
                      {touched.phone && checkoutFieldErrors.phone && (
                        <p className="mt-1 text-xs text-destructive">{checkoutFieldErrors.phone}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Email
                      </label>
                      <input
                        ref={emailInputRef}
                        id="checkout-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        onBlur={() => markCheckoutTouched("email")}
                        className={`w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary ${
                          touched.email && checkoutFieldErrors.email
                            ? "border-destructive focus:border-destructive"
                            : "border-border"
                        }`}
                      />
                      {touched.email && checkoutFieldErrors.email && (
                        <p className="mt-1 text-xs text-destructive">{checkoutFieldErrors.email}</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-border bg-card p-5 shadow-card md:p-6">
                <div className="mb-5">
                  <h2 className="font-display text-2xl text-foreground">Delivery Details</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter your address carefully so the driver can find you easily.
                  </p>
                </div>

                <div className="space-y-4">
                  <Suspense
                    fallback={
                      <div className="rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                        Loading address lookup...
                      </div>
                    }
                  >
                    <AddressAutocompleteField
                      label="Delivery Address"
                      textareaId="checkout-address"
                      textareaRef={addressInputRef}
                      value={form.address}
                      onValueChange={(value) => updateField("address", value)}
                      onSuggestionSelect={(suggestion) => {
                        if (!isWithinStarVillageGeofence({ lat: suggestion.lat, lng: suggestion.lng })) {
                          setSelectedDestination({ lat: null, lng: null });
                          setTouched((prev) => ({ ...prev, address: true }));
                          toast.error(STAR_VILLAGE_DELIVERY_MESSAGE);
                          return;
                        }

                        setSelectedDestination({
                          lat: suggestion.lat,
                          lng: suggestion.lng,
                        });
                      }}
                      rows={3}
                      required
                      selected={selectedDestination.lat != null && selectedDestination.lng != null}
                      selectedMessage="Address suggestion selected"
                      hasError={touched.address && Boolean(checkoutFieldErrors.address)}
                    />
                  </Suspense>
                  {touched.address && checkoutFieldErrors.address && (
                    <p className="mt-1 text-xs text-destructive">{checkoutFieldErrors.address}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      Address status
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${addressConfidence.tone}`}
                    >
                      {addressConfidence.label}
                    </span>
                  </div>

                  {user && (
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => setShowSavedAddresses((prev) => !prev)}
                          className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">Saved addresses</p>
                            <p className="text-xs text-muted-foreground">Use one-tap address autofill</p>
                          </div>
                          {showSavedAddresses ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        {showSavedAddresses && (
                          <>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <p className="text-xs text-muted-foreground">
                                For default/delete changes, manage in{" "}
                                <Link to="/account" className="font-medium text-primary hover:underline">
                                  Account
                                </Link>
                                .
                              </p>

                              <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                  type="text"
                                  value={newSavedAddressLabel}
                                  onChange={(e) => setNewSavedAddressLabel(e.target.value)}
                                  placeholder="Save as Home"
                                  className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleSaveCurrentAddress()}
                                  disabled={savingCurrentAddress}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                                >
                                  {savingCurrentAddress ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <BookmarkPlus className="h-4 w-4" />
                                  )}
                                  Save current address
                                </button>
                              </div>
                            </div>

                            {loadingSavedAddresses ? (
                              <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading saved addresses...
                              </div>
                            ) : savedAddresses.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                                Save an address here to use it in one tap next time.
                              </div>
                            ) : (
                              <div className="grid gap-3">
                                {savedAddresses.map((address) => (
                                  <div
                                    key={address.id}
                                    className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => applySavedAddress(address)}
                                      className="min-w-0 flex-1 text-left"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium text-foreground">{address.label}</p>
                                        {address.is_default && (
                                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                            Default
                                          </span>
                                        )}
                                      </div>
                                      <p className="mt-2 text-sm text-muted-foreground">{address.address_text}</p>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => applySavedAddress(address)}
                                      className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                                    >
                                      <Home className="h-4 w-4" />
                                      Use
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Order Notes
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => updateField("notes", e.target.value)}
                      rows={3}
                      placeholder="Gate code, extra directions, delivery instructions..."
                      className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Item-specific notes from your cart will also be attached to the order.
                    </p>
                  </div>
                </div>
              </section>
                </>
              )}

              {checkoutStep === 2 && (
              <section className="rounded-[28px] border border-border bg-card p-5 shadow-card md:p-6">
                <div className="mb-5">
                  <h2 className="font-display text-2xl text-foreground">Payment Method</h2>
                  <p className="text-sm text-muted-foreground">
                    Choose how you want to pay for this order.
                  </p>
                </div>

                <div className="grid gap-3">
                  {paymentOptions.map((method) => {
                    const Icon = method.icon;
                    const active = form.payment === method.value;

                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => {
                          if (method.disabled) return;
                          updateField("payment", method.value);
                        }}
                        disabled={method.disabled}
                        className={`rounded-2xl border p-4 text-left transition-colors ${
                          active
                            ? "border-primary bg-primary/10"
                            : method.disabled
                              ? "border-border bg-background opacity-60"
                              : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${
                              active ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-foreground">{method.label}</p>
                              {active && (
                                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                                  Selected
                                </span>
                              )}
                              {!active && method.disabled && (
                                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                  {method.value === "card" ? "Temporarily unavailable" : "Apply voucher first"}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {method.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className={`mt-4 rounded-2xl border p-4 ${paymentClarity.tone}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em]">Payment clarity</p>
                  <p className="mt-1 text-sm font-semibold">{paymentClarity.title}</p>
                  <p className="mt-1 text-sm">{paymentClarity.description}</p>
                </div>

                <div className="mt-5 border-t border-border pt-4">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Voucher / Gift Card
                  </label>

                  {voucherInfo ? (
                    <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-success" />
                        <span className="text-sm font-semibold text-success">
                          {voucherInfo.code} (-{priceFormatter.format(voucherInfo.discountAmount)})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={removeVoucher}
                        className="text-xs font-medium text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        ref={voucherInputRef}
                        id="checkout-voucher-code"
                        type="text"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                        placeholder="Enter code"
                        className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={handleApplyVoucher}
                        disabled={applyingVoucher || !voucherCode.trim()}
                        className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {applyingVoucher ? "..." : "Apply"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-border bg-background p-4">
                  <button
                    type="button"
                    onClick={() => setShowVoucherSummary((prev) => !prev)}
                    className="flex w-full items-center justify-between"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Payment breakdown
                    </p>
                    {showVoucherSummary ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {showVoucherSummary && (
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Applied amount</span>
                        <span className="font-semibold text-success">
                          {discountAmount > 0 ? `-${priceFormatter.format(discountAmount)}` : "R0"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Remaining balance</span>
                        <span className="font-semibold text-foreground">
                          {priceFormatter.format(adjustedTotal)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Voucher payment allowed</span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            voucherPaymentAllowed
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {voucherPaymentAllowed ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
              )}

              {checkoutStep === 3 && (
                <section className="rounded-[28px] border border-border bg-card p-5 shadow-card md:p-6">
                  <h2 className="font-display text-2xl text-foreground">Review & Place</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Confirm your delivery details, payment method, and order total, then place your order.
                  </p>
                  <div className="mt-4 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    Payment method: <span className="font-semibold text-foreground">{selectedPaymentLabel}</span>
                  </div>
                </section>
              )}
            </form>

            <div
              className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur md:p-4 xl:left-0"
              style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
            >
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Subtotal</p>
                      <p className="font-semibold text-foreground">{priceFormatter.format(subtotal)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Delivery</p>
                      <p className="font-semibold text-foreground">
                        {deliveryFee === 0 ? "Free" : priceFormatter.format(deliveryFee)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Voucher discount</p>
                      <p className="font-semibold text-success">
                        {discountAmount > 0 ? `-${priceFormatter.format(discountAmount)}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Final total</p>
                      <p className="font-display text-lg text-primary">{priceFormatter.format(adjustedTotal)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {checkoutStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setCheckoutStep((prev) => (Math.max(1, prev - 1) as CheckoutStep))}
                      className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Back
                    </button>
                  )}

                  {checkoutStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (checkoutStep === 1) {
                          setTouched((prev) => ({
                            ...prev,
                            name: true,
                            phone: true,
                            address: true,
                            email: form.payment === "card" ? true : prev.email,
                          }));
                          if (!canContinueDeliveryStep) {
                            focusFirstInvalidForDelivery();
                            toast.error(
                              !user
                                ? "Please sign in before placing your order."
                                : "Please complete required delivery fields."
                            );
                            return;
                          }
                          setCheckoutStep(2);
                          return;
                        }

                        if (!canContinuePaymentStep) {
                          focusFirstInvalidForPayment();
                          toast.error("Apply a valid prepaid voucher to continue with voucher payment.");
                          return;
                        }

                        setCheckoutStep(3);
                      }}
                      className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      {checkoutStep === 1 ? "Continue to Payment" : "Continue to Review & Place"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => checkoutFormRef.current?.requestSubmit()}
                      disabled={submitting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {orderButtonLabel}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="sticky top-24 space-y-4">
                <div className="rounded-[28px] border border-border bg-card p-5 shadow-card md:p-6">
                  <div className="mb-5">
                    <h3 className="font-display text-2xl text-foreground">Order Summary</h3>
                    <p className="text-sm text-muted-foreground">
                      Review your items before placing the order.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      <span>Free delivery progress</span>
                      <span>
                        {qualifiesForFreeDelivery
                          ? "Unlocked"
                          : `${priceFormatter.format(freeDeliveryRemaining)} away`}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${deliveryProgress}%` }}
                      />
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {qualifiesForFreeDelivery
                        ? "You qualify for free delivery."
                        : `Add ${priceFormatter.format(
                            freeDeliveryRemaining
                          )} more to get free delivery.`}
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {items.map((item) => {
                      const hasImage = Boolean(item.product.image?.trim());

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-border bg-background p-3"
                        >
                          <div className="flex gap-3">
                            {hasImage ? (
                              <img
                                src={item.product.image}
                                alt={item.product.name}
                                className="h-16 w-16 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                                <ImageOff className="h-4 w-4" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-foreground">
                                    {item.product.name}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {item.quantity} × {priceFormatter.format(item.finalUnitPrice)}
                                  </p>

                                  {item.selectedOptions?.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {item.selectedOptions.map((option) => (
                                        <span
                                          key={`${item.id}-${option.groupId}-${option.itemId}`}
                                          className="rounded-full bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground"
                                        >
                                          {option.groupName}: {option.itemName}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <p className="text-sm font-semibold text-foreground">
                                  {priceFormatter.format(item.finalUnitPrice * item.quantity)}
                                </p>
                              </div>

                              {item.note && (
                                <p className="mt-2 rounded-lg bg-card px-2.5 py-2 text-xs text-muted-foreground">
                                  Note: {item.note}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    Totals and voucher adjustments are pinned in the checkout action bar below.
                  </div>
                </div>

                <div className="rounded-[28px] border border-border bg-card p-5 shadow-card">
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Clock3 className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">What happens next?</p>
                      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                        <li>• Your order is created instantly.</li>
                        <li>• You can track progress after checkout.</li>
                        <li>• Card payments continue via PayFast securely.</li>
                        <li>• EFT payments remain pending until confirmed.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Link
                  to="/menu"
                  className="block text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Continue shopping
                </Link>
              </div>
            </aside>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
