import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Trash2,
} from "lucide-react";
import Footer from "@/components/Footer";
import AddressAutocompleteField from "@/components/AddressAutocompleteField";
import {
  geocodeSouthAfricaAddress,
} from "@/lib/maps";
import {
  findDuplicateSavedAddress,
  getNextDefaultSavedAddress,
  normalizeSavedAddressLabel,
  normalizeSavedAddressText,
  sortSavedAddresses,
  type SavedAddressRecord,
} from "@/lib/savedAddresses";

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

type ExtendedPaymentMethod = PaymentMethod | "voucher";
type CheckoutStep = 1 | 2 | 3;

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
const SOUTH_AFRICAN_PHONE_REGEX = /^0\d{9}$/;

function getPhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

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

  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherInfo, setVoucherInfo] = useState<VoucherInfo | null>(null);
  const [applyingVoucher, setApplyingVoucher] = useState(false);

  const [form, setForm] = useState({
    name: profile?.display_name || "",
    phone: profile?.phone || "",
    email: user?.email || "",
    address: profile?.default_address || "",
    notes: "",
    payment: "cash" as ExtendedPaymentMethod,
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [savedAddresses, setSavedAddresses] = useState<SavedAddressRecord[]>([]);
  const [loadingSavedAddresses, setLoadingSavedAddresses] = useState(true);
  const [savingCurrentAddress, setSavingCurrentAddress] = useState(false);
  const [deletingSavedAddressId, setDeletingSavedAddressId] = useState<string | null>(null);
  const [defaultingSavedAddressId, setDefaultingSavedAddressId] = useState<string | null>(null);
  const [newSavedAddressLabel, setNewSavedAddressLabel] = useState("");
  const [selectedDestination, setSelectedDestination] = useState<{
    lat: number | null;
    lng: number | null;
  }>({
    lat: null,
    lng: null,
  });


  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: prev.name || profile?.display_name || "",
      phone: prev.phone || profile?.phone || "",
      email: prev.email || user?.email || "",
      address: prev.address || profile?.default_address || "",
    }));
  }, [profile?.display_name, profile?.phone, profile?.default_address, user?.email]);

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

  const update = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));

    if (field === "address") {
      setSelectedDestination({ lat: null, lng: null });
    }
  };

  const markTouched = (field: keyof typeof form) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const applySavedAddress = (address: SavedAddressRecord) => {
    update("address", address.address_text);
    setSelectedDestination({
      lat: address.destination_lat,
      lng: address.destination_lng,
    });
    toast.success(`${address.label} added to checkout.`);
  };

  const getCheckoutValidationMessages = () => {
    const messages: string[] = [];
    const trimmedName = form.name.trim();
    const trimmedAddress = form.address.trim();
    const trimmedEmail = form.email.trim();
    const phoneDigits = getPhoneDigits(form.phone);

    if (!user) {
      messages.push("Please sign in before placing your order.");
    }

    if (!trimmedName) {
      messages.push("Full name is required.");
    }

    if (!phoneDigits) {
      messages.push("Cell phone number is required.");
    } else if (!SOUTH_AFRICAN_PHONE_REGEX.test(phoneDigits)) {
      messages.push("Enter a valid South African cell phone number with 10 digits.");
    }

    if (!trimmedAddress) {
      messages.push("Delivery address is required.");
    }

    if (form.payment === "card" && !trimmedEmail) {
      messages.push("Email is required for card payments.");
    }

    return messages;
  };

  const discountAmount = voucherInfo?.discountAmount || 0;
  const adjustedTotal = Math.max(0, total - discountAmount);
  const prepaidVoucherApplied = voucherInfo?.type === "prepaid";
  const voucherProviderLabel =
    voucherInfo?.provider ? VOUCHER_PROVIDER_LABELS[voucherInfo.provider] : "Prepaid voucher";
  const voucherCoversFullOrder = prepaidVoucherApplied && adjustedTotal === 0;
  const selectedPaymentLabel =
    form.payment === "voucher"
      ? voucherProviderLabel
      : paymentOptionsLabel(form.payment);
  const deliveryProgress =
    items.length === 0
      ? 0
      : Math.min((subtotal / freeDeliveryThreshold) * 100, 100);

  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<keyof typeof form, string>> = {};
    const trimmedName = form.name.trim();
    const trimmedAddress = form.address.trim();
    const trimmedEmail = form.email.trim();
    const phoneDigits = getPhoneDigits(form.phone);

    if (!trimmedName) {
      errors.name = "Full name is required.";
    }

    if (!phoneDigits) {
      errors.phone = "Cell phone number is required.";
    } else if (!SOUTH_AFRICAN_PHONE_REGEX.test(phoneDigits)) {
      errors.phone = "Enter a valid South African cell phone number (10 digits).";
    }

    if (!trimmedAddress) {
      errors.address = "Delivery address is required.";
    }

    if (form.payment === "card" && !trimmedEmail) {
      errors.email = "Email is required for card payments.";
    }

    return errors;
  }, [form]);

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
    if (form.payment === "card") return `Continue to PayFast — ${priceFormatter.format(adjustedTotal)}`;
    if (form.payment === "eft") return `Place EFT Order — ${priceFormatter.format(adjustedTotal)}`;
    if (form.payment === "voucher") {
      return voucherCoversFullOrder
        ? `Place ${voucherProviderLabel} Order — Paid`
        : `Voucher balance remaining — ${priceFormatter.format(adjustedTotal)}`;
    }
    return `Place Order — ${priceFormatter.format(adjustedTotal)}`;
  }, [submitting, form.payment, adjustedTotal, voucherCoversFullOrder, voucherProviderLabel]);

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

  const handleDeleteSavedAddress = async (address: SavedAddressRecord) => {
    if (!user) return;

    setDeletingSavedAddressId(address.id);

    try {
      const { error } = await supabase
        .from("saved_addresses")
        .delete()
        .eq("id", address.id)
        .eq("user_id", user.id);

      if (error) throw error;

      if (address.is_default) {
        const nextDefaultAddress = getNextDefaultSavedAddress(savedAddresses, address.id);

        if (nextDefaultAddress) {
          const { error: nextDefaultError } = await supabase
            .from("saved_addresses")
            .update({ is_default: true })
            .eq("id", nextDefaultAddress.id)
            .eq("user_id", user.id);

          if (nextDefaultError) throw nextDefaultError;
        }

        const { error: profileError } = await supabase
          .from("profiles")
          .update({ default_address: nextDefaultAddress?.address_text || "" })
          .eq("user_id", user.id);

        if (profileError) throw profileError;
      }

      await refreshSavedAddresses();
      toast.success("Saved address removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove address");
    } finally {
      setDeletingSavedAddressId(null);
    }
  };

  const handleSetDefaultSavedAddress = async (address: SavedAddressRecord) => {
    if (!user) return;

    setDefaultingSavedAddressId(address.id);

    try {
      const { error } = await supabase
        .from("saved_addresses")
        .update({ is_default: true })
        .eq("id", address.id)
        .eq("user_id", user.id);

      if (error) throw error;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ default_address: address.address_text })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      await refreshSavedAddresses();
      toast.success(`${address.label} is now your default checkout address.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update default address");
    } finally {
      setDefaultingSavedAddressId(null);
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

      if (form.payment === "card") {
        const { data: payfastData, error: payfastError } = await supabase.functions.invoke(
          "create-payfast-checkout",
          {
            body: {
              orderId: order.orderId,
            },
          }
        );

        if (payfastError || !payfastData?.url) {
          toast.error(
            `Failed to start payment: ${payfastError?.message || "No payment URL returned"}`
          );
          navigate(`/order-tracking/${order.orderId}`);
          return;
        }

        clearCart();
        window.location.href = payfastData.url;
        return;
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
                      onClick={() => handleStepChange(item.step)}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                        currentStep === item.step
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>

              {currentStep === 1 && (
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
                      type="text"
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      onBlur={() => markTouched("name")}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                      required
                    />
                    {touched.name && fieldErrors.name && (
                      <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => update("phone", e.target.value)}
                        onBlur={() => markTouched("phone")}
                        placeholder="0XXXXXXXXX"
                        inputMode="numeric"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                        required
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        South African cell phone numbers should be 10 digits.
                      </p>
                      {touched.phone && fieldErrors.phone && (
                        <p className="mt-1 text-xs text-destructive">{fieldErrors.phone}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Email
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        onBlur={() => markTouched("email")}
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                      />
                      {touched.email && fieldErrors.email && (
                        <p className="mt-1 text-xs text-destructive">{fieldErrors.email}</p>
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
                  <AddressAutocompleteField
                    label="Delivery Address"
                    value={form.address}
                    onValueChange={(value) => update("address", value)}
                    onSuggestionSelect={(suggestion) => {
                      setSelectedDestination({
                        lat: suggestion.lat,
                        lng: suggestion.lng,
                      });
                    }}
                    rows={3}
                    required
                    selected={selectedDestination.lat != null && selectedDestination.lng != null}
                    selectedMessage="Address suggestion selected"
                  />
                  {touched.address && fieldErrors.address && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.address}</p>
                  )}

                  {user && (
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">Saved addresses</p>
                            <p className="text-xs text-muted-foreground">
                              Tap one to autofill checkout or save the address you entered above.
                            </p>
                          </div>

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

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => applySavedAddress(address)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                                  >
                                    <Home className="h-4 w-4" />
                                    Use
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleSetDefaultSavedAddress(address)}
                                    disabled={address.is_default || defaultingSavedAddressId === address.id}
                                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                  >
                                    <Home className="h-4 w-4" />
                                    {address.is_default
                                      ? "Default"
                                      : defaultingSavedAddressId === address.id
                                        ? "Updating..."
                                        : "Set Default"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteSavedAddress(address)}
                                    disabled={deletingSavedAddressId === address.id}
                                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                  >
                                    {deletingSavedAddressId === address.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
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
                      onChange={(e) => update("notes", e.target.value)}
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

              {currentStep === 2 && (
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
                          update("payment", method.value);
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
                                  Apply voucher first
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

                {form.payment === "card" && (
                  <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    You’ll be redirected to PayFast for secure card payment. An email address is required.
                  </div>
                )}

                {form.payment === "eft" && (
                  <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    EFT orders are created with payment pending. Preparation and dispatch should only continue after payment is confirmed manually.
                  </div>
                )}

                {form.payment === "cash" && (
                  <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    Pay the driver on delivery. Please have the correct amount ready if possible.
                  </div>
                )}

                {form.payment === "voucher" && (
                  <div className="mt-4 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-success">
                    {voucherCoversFullOrder
                      ? `${voucherProviderLabel} will fully pay for this order during checkout.`
                      : `${voucherProviderLabel} is applied as a discount, but another payment method is still required for the remaining balance.`}
                  </div>
                )}

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
              </section>
              )}

              {currentStep === 3 && (
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
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep((prev) => (Math.max(1, prev - 1) as CheckoutStep))}
                      className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Back
                    </button>
                  )}

                  {currentStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (currentStep === 1) {
                          setTouched((prev) => ({
                            ...prev,
                            name: true,
                            phone: true,
                            address: true,
                            email: form.payment === "card" ? true : prev.email,
                          }));
                          if (!canContinueFromDelivery) {
                            toast.error(
                              !user
                                ? "Please sign in before placing your order."
                                : "Please complete required delivery fields."
                            );
                            return;
                          }
                          setCurrentStep(2);
                          return;
                        }

                        if (!canContinueFromPayment) {
                          toast.error("Apply a valid prepaid voucher to continue with voucher payment.");
                          return;
                        }

                        setCurrentStep(3);
                      }}
                      className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      {currentStep === 1 ? "Continue to Payment" : "Continue to Review & Place"}
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
