import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { generateDeliveryConfirmationCode } from "@/lib/deliveryConfirmation";
import { formatSupabaseError, isSchemaCompatibilityError } from "@/lib/supabaseSchemaCompatibility";
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
import { geocodeSouthAfricaAddress } from "@/lib/maps";
import {
  geocodeSouthAfricaAddress,
  searchSouthAfricaAddresses,
  type AddressSuggestion,
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

interface InsertedOrderItemRow {
  id: string;
}

type ExtendedPaymentMethod = PaymentMethod | "voucher";
type OrderInsertPayload = Record<string, string | number | null>;
type OrderItemInsertPayload = Record<string, string | number | null>;

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

  const [submitting, setSubmitting] = useState(false);
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

  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
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

    if (field === "address") {
      setSelectedDestination({ lat: null, lng: null });
    }
  };

  const applySavedAddress = (address: SavedAddressRecord) => {
    update("address", address.address_text);
    setSelectedDestination({
      lat: address.destination_lat,
      lng: address.destination_lng,
    });
    setShowSuggestions(false);
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
      const isUuid = (value: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value
        );

      const candidateProductIds = items
        .map((item) => item.product.id)
        .filter((id): id is string => Boolean(id) && isUuid(id));

      const { data: existingProducts, error: productsCheckError } = await supabase
        .from("products")
        .select("id")
        .in("id", candidateProductIds);

      if (productsCheckError) throw productsCheckError;

      const validProductIds = new Set((existingProducts || []).map((p) => p.id));

      const orderItems = items.map((item) => ({
        product_id: validProductIds.has(item.product.id) ? item.product.id : null,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        options_total: item.optionsTotal || 0,
        final_unit_price: item.finalUnitPrice || item.product.price,
        total_price: (item.finalUnitPrice || item.product.price) * item.quantity,
        item_note: item.note?.trim() || null,
      }));

      const hasMissingProducts = orderItems.some((item) => item.product_id === null);

      if (hasMissingProducts) {
        toast.error("Some cart items are outdated. Please clear your cart and add them again.");
        throw new Error("Cart contains outdated product references");
      }

      const destination =
        selectedDestination.lat != null && selectedDestination.lng != null
          ? selectedDestination
          : await geocodeSouthAfricaAddress(form.address);

      const isProviderVoucherPayment =
        form.payment === "voucher" &&
        voucherInfo?.type === "prepaid" &&
        voucherInfo.source === "provider";

      const paymentProvider =
        form.payment === "card"
          ? "payfast"
          : form.payment === "eft"
            ? "eft"
            : form.payment === "voucher"
              ? voucherInfo?.provider || "voucher"
              : null;

      const paymentStatus =
        form.payment === "card" || form.payment === "eft"
          ? "pending"
          : isProviderVoucherPayment
            ? "pending"
          : form.payment === "voucher"
            ? "paid"
            : null;

      const itemNotes = items
        .map((item) => {
          const optionSummary = item.selectedOptions?.length
            ? `Options: ${item.selectedOptions
                .map((option) => `${option.groupName} - ${option.itemName}`)
                .join(", ")}`
            : "";
          const noteSummary = item.note?.trim() ? `Note: ${item.note.trim()}` : "";
          const detailSummary = [optionSummary, noteSummary].filter(Boolean).join(" · ");

          if (!detailSummary) return "";

          return `- ${item.product.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}: ${detailSummary}`;
        })
        .filter(Boolean);

      const combinedNotes = [
        form.notes.trim(),
        itemNotes.length > 0 ? `Item notes:\n${itemNotes.join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const deliveryConfirmationCode = generateDeliveryConfirmationCode();

      const fullOrderPayload: OrderInsertPayload = {
        user_id: user.id,
        customer_name: form.name.trim(),
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        delivery_address: form.address.trim(),
        destination_lat: destination?.lat ?? null,
        destination_lng: destination?.lng ?? null,
        notes: combinedNotes || null,
        payment_method: form.payment,
        payment_provider: paymentProvider,
        payment_status: paymentStatus,
        subtotal,
        delivery_fee: deliveryFee,
        discount_amount: discountAmount,
        voucher_code: voucherInfo?.code || null,
        delivery_confirmation_code: deliveryConfirmationCode,
        total: adjustedTotal,
      };

      const deliveryCompatibleOrderPayload: OrderInsertPayload = {
        user_id: user.id,
        customer_name: form.name.trim(),
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        delivery_address: form.address.trim(),
        notes: combinedNotes || null,
        payment_method: form.payment,
        subtotal,
        delivery_fee: deliveryFee,
        discount_amount: discountAmount,
        voucher_code: voucherInfo?.code || null,
        delivery_confirmation_code: deliveryConfirmationCode,
        total: adjustedTotal,
      };

      const voucherCompatibleOrderPayload: OrderInsertPayload = {
        user_id: user.id,
        customer_name: form.name.trim(),
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        delivery_address: form.address.trim(),
        notes: combinedNotes || null,
        payment_method: form.payment,
        subtotal,
        delivery_fee: deliveryFee,
        discount_amount: discountAmount,
        voucher_code: voucherInfo?.code || null,
        total: adjustedTotal,
      };

      const legacyOrderPayload: OrderInsertPayload = {
        user_id: user.id,
        customer_name: form.name.trim(),
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        delivery_address: form.address.trim(),
        notes: combinedNotes || null,
        payment_method: form.payment,
        subtotal,
        delivery_fee: deliveryFee,
        total: adjustedTotal,
      };

      const orderPayloadCandidates = [
        fullOrderPayload,
        deliveryCompatibleOrderPayload,
        voucherCompatibleOrderPayload,
        legacyOrderPayload,
      ];

      let orderResult = await supabase
        .from("orders")
        .insert(orderPayloadCandidates[0])
        .select("id");

      for (let index = 1; index < orderPayloadCandidates.length; index += 1) {
        if (!orderResult.error || !isSchemaCompatibilityError(orderResult.error)) {
          break;
        }

        orderResult = await supabase
          .from("orders")
          .insert(orderPayloadCandidates[index])
          .select("id");
      }

      const { data: insertedOrders, error: orderError } = orderResult;

      if (orderError) throw orderError;

      const order = insertedOrders?.[0];

      if (!order?.id) {
        throw new Error("Order insert completed but no order id was returned.");
      }

      const fullOrderItemsPayload = orderItems.map((item, index) => {
        const cartItem = items[index];
        const selectedOptionLabels = cartItem.selectedOptions?.length
          ? ` (${cartItem.selectedOptions
              .map((option) => `${option.groupName}: ${option.itemName}`)
              .join(", ")})`
          : "";

        const legacyProductName = `${item.product_name}${selectedOptionLabels}`.trim();

        return {
          full: {
            order_id: order.id,
            ...item,
          } satisfies OrderItemInsertPayload,
          legacy: {
            order_id: order.id,
            product_id: item.product_id,
            product_name: legacyProductName,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
          } satisfies OrderItemInsertPayload,
        };
      });

      let insertedOrderItemsResult = await supabase
        .from("order_items")
        .insert(fullOrderItemsPayload.map((item) => item.full))
        .select("id");

      if (insertedOrderItemsResult.error && isSchemaCompatibilityError(insertedOrderItemsResult.error)) {
        insertedOrderItemsResult = await supabase
          .from("order_items")
          .insert(fullOrderItemsPayload.map((item) => item.legacy))
          .select("id");
      }

      const { data: insertedOrderItemsData, error: itemsError } = insertedOrderItemsResult;

      if (itemsError) throw itemsError;
      const insertedOrderItems = (insertedOrderItemsData || []) as InsertedOrderItemRow[];

      for (let index = 0; index < items.length; index++) {
        const insertedOrderItemId = insertedOrderItems?.[index]?.id;
        const cartItem = items[index];

        if (!insertedOrderItemId || !cartItem.selectedOptions?.length) continue;

        const optionRows = cartItem.selectedOptions.map((option) => ({
          order_item_id: insertedOrderItemId,
          option_group_name: option.groupName,
          option_item_name: option.itemName,
          price_delta: option.priceDelta,
        }));

        const { error: optionInsertError } = await supabase
          .from("order_item_options")
          .insert(optionRows);

        if (optionInsertError && !isSchemaCompatibilityError(optionInsertError)) {
          throw optionInsertError;
        }
      }

      if (voucherInfo?.source === "local" && voucherInfo.id) {
        const { error: redemptionError } = await supabase.from("voucher_redemptions").insert({
          voucher_id: voucherInfo.id,
          order_id: order.id,
          user_id: user.id,
          amount: discountAmount,
        });

        if (redemptionError) throw redemptionError;

        const voucherUpdatePayload: {
          used_count: number;
          balance?: number;
        } = {
          used_count: voucherInfo.usedCount + 1,
        };

        if (voucherInfo.type === "prepaid") {
          voucherUpdatePayload.balance = Math.max(0, voucherInfo.balance - discountAmount);
        }

        const { error: voucherUpdateError } = await supabase
          .from("vouchers")
          .update(voucherUpdatePayload)
          .eq("id", voucherInfo.id);

        if (voucherUpdateError) throw voucherUpdateError;
      }

      if (isProviderVoucherPayment && voucherInfo?.provider === "one_voucher") {
        const { data: redemptionData, error: redemptionError } = await supabase.functions.invoke(
          "onevoucher-voucher",
          {
            body: {
              action: "redeem",
              code: voucherInfo.code,
              amount: discountAmount,
              orderId: order.id,
              currency: "ZAR",
              customerEmail,
              customerPhone,
            },
          }
        );

        if (redemptionError || !redemptionData?.success) {
          await supabase
            .from("orders")
            .update({
              payment_status: "failed",
            })
            .eq("id", order.id);

          throw new Error(
            redemptionData?.message || redemptionError?.message || "1Voucher redemption failed"
          );
        }

        const { error: orderPaymentUpdateError } = await supabase
          .from("orders")
          .update({
            payment_provider: "one_voucher",
            payment_status: "paid",
            payment_reference:
              redemptionData.providerReference || voucherInfo.providerReference || voucherInfo.code,
          })
          .eq("id", order.id);

        if (orderPaymentUpdateError) throw orderPaymentUpdateError;
      }

      if (form.payment === "card") {
        const { data: payfastData, error: payfastError } = await supabase.functions.invoke(
          "create-payfast-checkout",
          {
            body: {
              orderId: order.id,
              total: adjustedTotal,
              customerName: form.name.trim(),
              customerEmail,
              itemName: `Village Eats Order #${order.id.slice(0, 8).toUpperCase()}`,
            },
          }
        );

        if (payfastError || !payfastData?.url) {
          toast.error(
            `Failed to start payment: ${payfastError?.message || "No payment URL returned"}`
          );
          navigate(`/order-tracking/${order.id}`);
          return;
        }

        clearCart();
        window.location.href = payfastData.url;
        return;
      }

      if (form.payment === "eft") {
        clearCart();
        toast.success("Order placed. Please complete your EFT payment and keep your order reference.");
        navigate(`/order-tracking/${order.id}`);
        return;
      }

      if (form.payment === "voucher") {
        clearCart();
        toast.success(`${voucherProviderLabel} accepted. Order placed and marked as paid.`);
        navigate(`/order-tracking/${order.id}`);
        return;
      }

      clearCart();
      toast.success("Order placed successfully.");
      navigate(`/order-tracking/${order.id}`);
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
            Review your details, choose payment, and place your order with confidence.
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
            <form onSubmit={handleSubmit} className="space-y-5">
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
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                      required
                    />
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
                        placeholder="0XXXXXXXXX"
                        inputMode="numeric"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                        required
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        South African cell phone numbers should be 10 digits.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Email
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                      />
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
              </section>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {orderButtonLabel}
              </button>
            </form>

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

                  <div className="mt-5 space-y-2 border-t border-border pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payment</span>
                      <span className="text-foreground">{selectedPaymentLabel}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground">{priceFormatter.format(subtotal)}</span>
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-success">
                        <span>{voucherInfo?.provider ? `${voucherProviderLabel} applied` : "Discount"}</span>
                        <span>-{priceFormatter.format(discountAmount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="text-foreground">
                        {deliveryFee === 0 ? "Free" : priceFormatter.format(deliveryFee)}
                      </span>
                    </div>

                    <div className="flex justify-between border-t border-border pt-3 font-display text-xl">
                      <span className="text-foreground">TOTAL</span>
                      <span className="text-primary">{priceFormatter.format(adjustedTotal)}</span>
                    </div>
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
