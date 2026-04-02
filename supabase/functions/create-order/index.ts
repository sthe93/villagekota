import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type PaymentMethod = "cash" | "card" | "eft" | "voucher";
type VoucherSource = "local" | "provider";
type VoucherProvider = "one_voucher" | "ott_voucher" | "blu_voucher" | "instant_money";

type CartOptionInput = {
  groupId?: string;
  itemId?: string;
};

type CartItemInput = {
  productId?: string;
  quantity?: number;
  note?: string | null;
  selectedOptions?: CartOptionInput[];
};

type CreateOrderRequest = {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  deliveryAddress?: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  notes?: string | null;
  paymentMethod?: PaymentMethod;
  items?: CartItemInput[];
  voucherCode?: string | null;
  voucherSource?: VoucherSource | null;
  voucherProvider?: VoucherProvider | null;
  cardPaymentConfirmed?: boolean;
  cardPaymentReference?: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  price: number | string;
  is_available: boolean | null;
};

type ProductOptionItemRow = {
  id: string;
  name: string;
  price_delta: number | string | null;
  is_available: boolean | null;
};

type ProductOptionGroupRow = {
  id: string;
  product_id: string;
  name: string;
  selection_type: string | null;
  min_select: number | null;
  max_select: number | null;
  is_required: boolean | null;
  is_active: boolean | null;
  product_option_items: ProductOptionItemRow[] | null;
};

type VoucherRow = {
  id: string;
  code: string;
  type: string;
  value: number | string;
  balance: number | string | null;
  min_order: number | string | null;
  max_uses: number | null;
  used_count: number | null;
  is_active: boolean | null;
  expires_at: string | null;
  provider: string | null;
};

type PreparedSelectedOption = {
  groupId: string;
  groupName: string;
  itemId: string;
  itemName: string;
  priceDelta: number;
};

type PreparedItem = {
  productId: string;
  productName: string;
  quantity: number;
  note: string | null;
  unitPrice: number;
  optionsTotal: number;
  finalUnitPrice: number;
  totalPrice: number;
  selectedOptions: PreparedSelectedOption[];
};

const DELIVERY_FEE = 25;
const FREE_DELIVERY_THRESHOLD = 150;
const STAR_VILLAGE_ADDRESS_PATTERN = /\bstar\s+village\b/i;
const STAR_VILLAGE_CENTER = { lat: -26.2856, lng: 27.7594 };
const STAR_VILLAGE_RADIUS_METERS = 2200;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function getEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeVoucherCode(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, "").trim().toUpperCase();
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const inner =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const arc = 2 * Math.atan2(Math.sqrt(inner), Math.sqrt(1 - inner));
  return earthRadiusMeters * arc;
}

function isWithinStarVillageGeofence(destination: { lat: number; lng: number }) {
  return haversineDistanceMeters(STAR_VILLAGE_CENTER, destination) <= STAR_VILLAGE_RADIUS_METERS;
}

function isStarVillageAddress(address: string) {
  return STAR_VILLAGE_ADDRESS_PATTERN.test(address.trim());
}

function normalizePhone(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

function generateDeliveryConfirmationCode() {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join("");
}

function buildOrderPaymentState(params: {
  paymentMethod: PaymentMethod;
  voucherSource: VoucherSource | null;
  voucherProvider: VoucherProvider | null;
  adjustedTotal: number;
  cardPaymentConfirmed: boolean;
}) {
  if (params.paymentMethod === "card") {
    return {
      paymentProvider: "payfast",
      paymentStatus: params.cardPaymentConfirmed ? "paid" : "pending",
    };
  }

  if (params.paymentMethod === "eft") {
    return {
      paymentProvider: "eft",
      paymentStatus: "pending",
    };
  }

  if (params.paymentMethod === "voucher") {
    return {
      paymentProvider:
        params.voucherSource === "provider"
          ? params.voucherProvider || "voucher"
          : params.voucherProvider || "voucher",
      paymentStatus: params.adjustedTotal === 0 ? "paid" : "pending",
    };
  }

  return {
    paymentProvider: null,
    paymentStatus: null,
  };
}

async function getAuthenticatedUser(params: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authHeader: string | null;
}) {
  if (!params.authHeader) {
    throw new Error("Missing authorization header");
  }

  const token = params.authHeader.replace("Bearer ", "").trim();
  if (!token) {
    throw new Error("Missing authorization token");
  }

  const supabaseAuth = createClient(params.supabaseUrl, params.supabaseAnonKey);
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(token);

  if (error || !user) {
    throw new Error(error?.message || "Not authenticated");
  }

  return user;
}

async function callOneVoucher(params: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authHeader: string;
  body: Record<string, unknown>;
}) {
  const response = await fetch(`${params.supabaseUrl}/functions/v1/onevoucher-voucher`, {
    method: "POST",
    headers: {
      Authorization: params.authHeader,
      apikey: params.supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.success) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : "1Voucher request failed";

    throw new Error(message);
  }

  return payload as {
    success: boolean;
    balance?: number | string | null;
    providerReference?: string | null;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    const user = await getAuthenticatedUser({
      supabaseUrl,
      supabaseAnonKey,
      authHeader,
    });

    const body = (await req.json()) as CreateOrderRequest;

    const customerName = body.customerName?.trim();
    const customerPhone = normalizePhone(body.customerPhone);
    const customerEmail = body.customerEmail?.trim() || user.email || null;
    const deliveryAddress = body.deliveryAddress?.trim();
    const destinationLat = typeof body.destinationLat === "number" ? body.destinationLat : null;
    const destinationLng = typeof body.destinationLng === "number" ? body.destinationLng : null;
    const paymentMethod = body.paymentMethod || "cash";
    const items = Array.isArray(body.items) ? body.items : [];
    const voucherCode = normalizeVoucherCode(body.voucherCode);
    const voucherSource = body.voucherSource || null;
    const voucherProvider = body.voucherProvider || null;
    const cardPaymentConfirmed = body.cardPaymentConfirmed === true;
    const cardPaymentReference = (body.cardPaymentReference || "").trim() || null;

    if (!customerName) throw new Error("Full name is required");
    if (!/^0\d{9}$/.test(customerPhone)) {
      throw new Error("Enter a valid South African cell phone number with 10 digits.");
    }
    if (!deliveryAddress) throw new Error("Delivery address is required");
    const hasDestinationCoordinates = destinationLat != null && destinationLng != null;
    if (
      destinationLat != null &&
      destinationLng != null &&
      !isWithinStarVillageGeofence({ lat: destinationLat, lng: destinationLng })
    ) {
      throw new Error("The selected address is outside our Star Village delivery zone.");
    }
    if (!hasDestinationCoordinates && !isStarVillageAddress(deliveryAddress)) {
      throw new Error(
        "Please choose a suggested address inside Star Village so we can verify your delivery location."
      );
    }
    if (paymentMethod === "card" && !customerEmail) {
      throw new Error("Email is required for card payments.");
    }
    if (paymentMethod === "card" && !cardPaymentConfirmed) {
      throw new Error("Card orders can only be created after confirmed PayFast payment.");
    }
    if (items.length === 0) throw new Error("Your cart is empty");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const productIds = [...new Set(items.map((item) => item.productId?.trim()).filter(Boolean))] as string[];
    const { data: productsData, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, name, price, is_available")
      .in("id", productIds);

    if (productsError) throw new Error(productsError.message);

    const productMap = new Map<string, ProductRow>(
      ((productsData || []) as ProductRow[]).map((product) => [product.id, product])
    );

    const { data: optionGroupsData, error: optionGroupsError } = await supabaseAdmin
      .from("product_option_groups")
      .select(`
        id,
        product_id,
        name,
        selection_type,
        min_select,
        max_select,
        is_required,
        is_active,
        product_option_items (
          id,
          name,
          price_delta,
          is_available
        )
      `)
      .in("product_id", productIds)
      .eq("is_active", true);

    if (optionGroupsError) throw new Error(optionGroupsError.message);

    const optionGroups = (optionGroupsData || []) as ProductOptionGroupRow[];
    const optionGroupsByProductId = new Map<string, ProductOptionGroupRow[]>();
    optionGroups.forEach((group) => {
      const existing = optionGroupsByProductId.get(group.product_id) || [];
      existing.push(group);
      optionGroupsByProductId.set(group.product_id, existing);
    });

    const preparedItems: PreparedItem[] = items.map((item) => {
      const productId = item.productId?.trim();
      if (!productId) throw new Error("Every cart item must include a product id.");

      const product = productMap.get(productId);
      if (!product || !product.is_available) {
        throw new Error("Some cart items are outdated or unavailable. Please refresh your cart.");
      }

      const quantity = Math.max(1, Number(item.quantity) || 1);
      const note = item.note?.trim() || null;
      const selectedOptionsInput = Array.isArray(item.selectedOptions) ? item.selectedOptions : [];
      const groupsForProduct = optionGroupsByProductId.get(productId) || [];
      const groupMap = new Map(groupsForProduct.map((group) => [group.id, group]));

      const selectedOptions = selectedOptionsInput.map((selected) => {
        const groupId = selected.groupId?.trim();
        const itemId = selected.itemId?.trim();

        if (!groupId || !itemId) {
          throw new Error("Selected options must include both group and item ids.");
        }

        const group = groupMap.get(groupId);
        if (!group || !group.is_active) {
          throw new Error("One or more selected options are no longer available.");
        }

        const optionItem = (group.product_option_items || []).find(
          (entry) => entry.id === itemId && entry.is_available !== false
        );

        if (!optionItem) {
          throw new Error("One or more selected options are no longer available.");
        }

        return {
          groupId,
          groupName: group.name,
          itemId,
          itemName: optionItem.name,
          priceDelta: roundCurrency(toNumber(optionItem.price_delta)),
        } satisfies PreparedSelectedOption;
      });

      const selectionsByGroup = new Map<string, PreparedSelectedOption[]>();
      selectedOptions.forEach((selectedOption) => {
        const existing = selectionsByGroup.get(selectedOption.groupId) || [];
        existing.push(selectedOption);
        selectionsByGroup.set(selectedOption.groupId, existing);
      });

      groupsForProduct.forEach((group) => {
        const selectedCount = (selectionsByGroup.get(group.id) || []).length;
        const minimumRequired = Math.max(group.min_select ?? 0, group.is_required ? 1 : 0);
        const maximumAllowed =
          group.max_select != null
            ? Number(group.max_select)
            : group.selection_type === "single"
              ? 1
              : null;

        if (selectedCount < minimumRequired) {
          throw new Error(`Please complete the required ${group.name} option for ${product.name}.`);
        }

        if (maximumAllowed != null && selectedCount > maximumAllowed) {
          throw new Error(`Too many selections were chosen for ${group.name} on ${product.name}.`);
        }
      });

      const unitPrice = roundCurrency(toNumber(product.price));
      const optionsTotal = roundCurrency(
        selectedOptions.reduce((sum, selectedOption) => sum + selectedOption.priceDelta, 0)
      );
      const finalUnitPrice = roundCurrency(unitPrice + optionsTotal);
      const totalPrice = roundCurrency(finalUnitPrice * quantity);

      return {
        productId,
        productName: product.name,
        quantity,
        note,
        unitPrice,
        optionsTotal,
        finalUnitPrice,
        totalPrice,
        selectedOptions,
      };
    });

    const subtotal = roundCurrency(
      preparedItems.reduce((sum, item) => sum + item.totalPrice, 0)
    );
    const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    const totalBeforeDiscount = roundCurrency(subtotal + deliveryFee);

    let discountAmount = 0;
    let localVoucher: VoucherRow | null = null;
    let providerVoucherReference: string | null = null;

    if (voucherCode) {
      if (voucherSource === "provider") {
        if (voucherProvider !== "one_voucher") {
          throw new Error("Only 1Voucher provider vouchers are currently supported.");
        }

        if (!authHeader) throw new Error("Authentication required for provider vouchers.");

        const providerValidation = await callOneVoucher({
          supabaseUrl,
          supabaseAnonKey,
          authHeader,
          body: {
            action: "validate",
            code: voucherCode,
            currency: "ZAR",
            customerEmail,
            customerPhone,
          },
        });

        discountAmount = roundCurrency(
          Math.min(toNumber(providerValidation.balance), totalBeforeDiscount)
        );

        if (discountAmount <= 0) {
          throw new Error("This 1Voucher PIN has no available balance.");
        }
      } else {
        const { data: voucherData, error: voucherError } = await supabaseAdmin
          .from("vouchers")
          .select("id, code, type, value, balance, min_order, max_uses, used_count, is_active, expires_at, provider")
          .eq("code", voucherCode)
          .eq("is_active", true)
          .maybeSingle();

        if (voucherError) throw new Error(voucherError.message);
        if (!voucherData) throw new Error("Invalid voucher code");

        localVoucher = voucherData as VoucherRow;

        if (localVoucher.expires_at && new Date(localVoucher.expires_at) < new Date()) {
          throw new Error("This voucher has expired");
        }

        if (localVoucher.max_uses && (localVoucher.used_count || 0) >= localVoucher.max_uses) {
          throw new Error("This voucher has been fully redeemed");
        }

        if (toNumber(localVoucher.min_order) > subtotal) {
          throw new Error("This voucher requires a higher minimum order total.");
        }

        if (localVoucher.type === "discount_percentage") {
          discountAmount = roundCurrency(subtotal * (toNumber(localVoucher.value) / 100));
        } else if (localVoucher.type === "discount_fixed") {
          discountAmount = roundCurrency(Math.min(toNumber(localVoucher.value), totalBeforeDiscount));
        } else if (localVoucher.type === "prepaid") {
          discountAmount = roundCurrency(
            Math.min(toNumber(localVoucher.balance), totalBeforeDiscount)
          );
        }

        if (discountAmount <= 0) {
          throw new Error("This voucher has no available balance.");
        }
      }
    }

    const adjustedTotal = roundCurrency(Math.max(0, totalBeforeDiscount - discountAmount));

    if (paymentMethod === "voucher") {
      if (!voucherCode) {
        throw new Error("Apply a valid prepaid voucher before choosing voucher payment.");
      }

      if (voucherSource !== "provider" && localVoucher?.type !== "prepaid") {
        throw new Error("Only prepaid vouchers can be used as the payment method.");
      }

      if (adjustedTotal > 0) {
        throw new Error(
          "This prepaid voucher does not cover the full order total yet. Use card, EFT, or cash for the remaining balance."
        );
      }
    }

    const paymentState = buildOrderPaymentState({
      paymentMethod,
      voucherSource,
      voucherProvider: voucherSource === "provider" ? voucherProvider : ((localVoucher?.provider as VoucherProvider | null) ?? null),
      adjustedTotal,
      cardPaymentConfirmed,
    });

    const itemNotes = preparedItems
      .map((item) => {
        const optionSummary = item.selectedOptions.length
          ? `Options: ${item.selectedOptions
              .map((option) => `${option.groupName} - ${option.itemName}`)
              .join(", ")}`
          : "";
        const noteSummary = item.note ? `Note: ${item.note}` : "";
        const detailSummary = [optionSummary, noteSummary].filter(Boolean).join(" · ");

        if (!detailSummary) return "";

        return `- ${item.productName}${item.quantity > 1 ? ` x${item.quantity}` : ""}: ${detailSummary}`;
      })
      .filter(Boolean);

    const combinedNotes = [body.notes?.trim() || "", itemNotes.length ? `Item notes:\n${itemNotes.join("\n")}` : ""]
      .filter(Boolean)
      .join("\n\n");

    const orderPayload = {
      user_id: user.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      delivery_address: deliveryAddress,
      destination_lat: body.destinationLat ?? null,
      destination_lng: body.destinationLng ?? null,
      notes: combinedNotes || null,
      payment_method: paymentMethod,
      payment_provider: paymentState.paymentProvider,
      payment_status: paymentState.paymentStatus,
      payment_reference: paymentMethod === "card" ? cardPaymentReference : null,
      subtotal,
      delivery_fee: deliveryFee,
      discount_amount: discountAmount,
      voucher_code: voucherCode || null,
      delivery_confirmation_code: generateDeliveryConfirmationCode(),
      total: adjustedTotal,
    };

    const { data: orderData, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert(orderPayload)
      .select("id, subtotal, delivery_fee, discount_amount, total, payment_status, payment_provider")
      .single();

    if (orderError) throw new Error(orderError.message);

    const orderId = orderData.id as string;

    const orderItemsPayload = preparedItems.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      options_total: item.optionsTotal,
      final_unit_price: item.finalUnitPrice,
      total_price: item.totalPrice,
      item_note: item.note,
    }));

    const { data: insertedOrderItems, error: orderItemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsPayload)
      .select("id");

    if (orderItemsError) throw new Error(orderItemsError.message);

    const orderItemRows = ((insertedOrderItems || []) as Array<{ id: string }>).map((item) => item.id);

    const optionRows = preparedItems.flatMap((item, index) =>
      item.selectedOptions.map((selectedOption) => ({
        order_item_id: orderItemRows[index],
        option_group_name: selectedOption.groupName,
        option_item_name: selectedOption.itemName,
        price_delta: selectedOption.priceDelta,
      }))
    );

    if (optionRows.length > 0) {
      const { error: optionInsertError } = await supabaseAdmin
        .from("order_item_options")
        .insert(optionRows);

      if (optionInsertError) throw new Error(optionInsertError.message);
    }

    if (localVoucher && discountAmount > 0) {
      const { error: redemptionError } = await supabaseAdmin
        .from("voucher_redemptions")
        .insert({
          voucher_id: localVoucher.id,
          order_id: orderId,
          user_id: user.id,
          amount: discountAmount,
        });

      if (redemptionError) throw new Error(redemptionError.message);

      const voucherUpdatePayload: Record<string, unknown> = {
        used_count: (localVoucher.used_count || 0) + 1,
      };

      if (localVoucher.type === "prepaid") {
        voucherUpdatePayload.balance = Math.max(0, toNumber(localVoucher.balance) - discountAmount);
      }

      const { error: voucherUpdateError } = await supabaseAdmin
        .from("vouchers")
        .update(voucherUpdatePayload)
        .eq("id", localVoucher.id);

      if (voucherUpdateError) throw new Error(voucherUpdateError.message);
    }

    if (voucherSource === "provider" && voucherProvider === "one_voucher" && discountAmount > 0) {
      if (!authHeader) throw new Error("Authentication required for provider vouchers.");

      const providerRedemption = await callOneVoucher({
        supabaseUrl,
        supabaseAnonKey,
        authHeader,
        body: {
          action: "redeem",
          code: voucherCode,
          amount: discountAmount,
          orderId,
          currency: "ZAR",
          customerEmail,
          customerPhone,
        },
      });

      providerVoucherReference =
        typeof providerRedemption.providerReference === "string"
          ? providerRedemption.providerReference
          : null;

      const { error: providerOrderUpdateError } = await supabaseAdmin
        .from("orders")
        .update({
          payment_provider: "one_voucher",
          payment_status: "paid",
          payment_reference: providerVoucherReference || voucherCode,
        })
        .eq("id", orderId);

      if (providerOrderUpdateError) throw new Error(providerOrderUpdateError.message);
    }

    return new Response(
      JSON.stringify({
        orderId,
        subtotal,
        deliveryFee,
        discountAmount,
        total: adjustedTotal,
        paymentStatus:
          voucherSource === "provider" && voucherProvider === "one_voucher"
            ? "paid"
            : paymentState.paymentStatus,
        paymentProvider:
          voucherSource === "provider" && voucherProvider === "one_voucher"
            ? "one_voucher"
            : paymentState.paymentProvider,
        paymentReference: providerVoucherReference,
        voucherCode: voucherCode || null,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      { status: 400, headers: corsHeaders }
    );
  }
});
