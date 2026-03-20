import React, { createContext, useContext, useEffect, useReducer } from "react";
import type { Product, SpiceLevel } from "@/data/products";
import type { SelectedOption } from "@/data/productOptions";

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  note?: string;
  selectedOptions: SelectedOption[];
  optionsTotal: number;
  finalUnitPrice: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

interface AddItemOptions {
  quantity?: number;
  note?: string;
  selectedOptions?: SelectedOption[];
  optionsTotal?: number;
  finalUnitPrice?: number;
}

type CartAction =
  | {
      type: "ADD_ITEM";
      product: Product;
      quantity: number;
      note?: string;
      selectedOptions: SelectedOption[];
      optionsTotal: number;
      finalUnitPrice: number;
    }
  | { type: "REMOVE_ITEM"; cartItemId: string }
  | { type: "UPDATE_QUANTITY"; cartItemId: string; quantity: number }
  | { type: "CLEAR_CART" }
  | { type: "TOGGLE_CART" }
  | { type: "SET_OPEN"; isOpen: boolean }
  | { type: "LOAD_CART"; items: CartItem[] };

const DELIVERY_FEE = 25;
const FREE_DELIVERY_THRESHOLD = 150;
const STORAGE_KEY = "village-eats-cart";
const LEGACY_STORAGE_KEY = "kota-cart";

function createCartItemId(productId: string) {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${productId}-${uuid}`;
}

function buildCartConfigKey(
  productId: string,
  note: string | undefined,
  selectedOptions: SelectedOption[]
) {
  const optionsKey = [...selectedOptions]
    .sort((a, b) =>
      `${a.groupId}:${a.itemId}`.localeCompare(`${b.groupId}:${b.itemId}`)
    )
    .map((option) => `${option.groupId}:${option.itemId}`)
    .join("|");

  return `${productId}__${(note || "").trim()}__${optionsKey}`;
}

function normalizeSpiceLevel(value: unknown): SpiceLevel {
  return value === "Mild" ||
    value === "Medium" ||
    value === "Hot" ||
    value === "Extra Hot"
    ? value
    : null;
}

function normalizeStoredProduct(raw: any): Product {
  const category =
    typeof raw?.category === "string" && raw.category.trim()
      ? raw.category.trim()
      : "Other";

  const price = Number(raw?.price ?? 0);
  const optionGroupCount = Math.max(
    0,
    Number(raw?.optionGroupCount ?? (raw?.hasOptions ? 1 : 0)) || 0
  );

  return {
    id: String(raw?.id),
    name:
      typeof raw?.name === "string" && raw.name.trim()
        ? raw.name.trim()
        : "Untitled Item",
    description:
      typeof raw?.description === "string" && raw.description.trim()
        ? raw.description.trim()
        : "Freshly prepared and packed with flavour.",
    price,
    category,
    image:
      typeof raw?.image === "string" && raw.image.trim() ? raw.image.trim() : "",
    spiceLevel: normalizeSpiceLevel(raw?.spiceLevel),
    isPopular: Boolean(raw?.isPopular),
    isFeatured: Boolean(raw?.isFeatured),
    inStock: raw?.inStock !== false,
    rating: Number(raw?.rating ?? 0),
    reviewCount: Number(raw?.reviewCount ?? 0),
    hasOptions: Boolean(raw?.hasOptions ?? optionGroupCount > 0),
    optionGroupCount,
  };
}

function normalizeStoredItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item: any) => item?.product?.id)
    .map((item: any) => {
      const product = normalizeStoredProduct(item.product);
      const selectedOptions = Array.isArray(item.selectedOptions)
        ? item.selectedOptions
        : [];

      const optionsTotal = Number(item.optionsTotal ?? 0);
      const fallbackFinalUnitPrice = product.price + optionsTotal;
      const finalUnitPrice = Number(
        item.finalUnitPrice ?? fallbackFinalUnitPrice
      );

      return {
        id:
          typeof item.id === "string" && item.id.trim()
            ? item.id
            : createCartItemId(String(product.id)),
        product,
        quantity: Math.max(1, Number(item.quantity) || 1),
        note:
          typeof item.note === "string" && item.note.trim()
            ? item.note.trim()
            : undefined,
        selectedOptions,
        optionsTotal,
        finalUnitPrice: Number.isFinite(finalUnitPrice)
          ? finalUnitPrice
          : fallbackFinalUnitPrice,
      };
    });
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const quantityToAdd = Math.max(1, action.quantity || 1);
      const normalizedNote = action.note?.trim() || "";
      const normalizedOptions = action.selectedOptions || [];
      const configKey = buildCartConfigKey(
        action.product.id,
        normalizedNote,
        normalizedOptions
      );

      const existing = state.items.find(
        (item) =>
          buildCartConfigKey(
            item.product.id,
            item.note,
            item.selectedOptions || []
          ) === configKey
      );

      if (existing) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === existing.id
              ? { ...item, quantity: item.quantity + quantityToAdd }
              : item
          ),
        };
      }

      return {
        ...state,
        items: [
          ...state.items,
          {
            id: createCartItemId(action.product.id),
            product: action.product,
            quantity: quantityToAdd,
            note: normalizedNote || undefined,
            selectedOptions: normalizedOptions,
            optionsTotal: action.optionsTotal,
            finalUnitPrice: action.finalUnitPrice,
          },
        ],
      };
    }

    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.cartItemId),
      };

    case "UPDATE_QUANTITY": {
      if (action.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((item) => item.id !== action.cartItemId),
        };
      }

      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.cartItemId
            ? { ...item, quantity: action.quantity }
            : item
        ),
      };
    }

    case "CLEAR_CART":
      return { ...state, items: [] };

    case "TOGGLE_CART":
      return { ...state, isOpen: !state.isOpen };

    case "SET_OPEN":
      return { ...state, isOpen: action.isOpen };

    case "LOAD_CART":
      return { ...state, items: action.items };

    default:
      return state;
  }
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: Product, options?: AddItemOptions) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  setOpen: (isOpen: boolean) => void;
  subtotal: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
  freeDeliveryThreshold: number;
  freeDeliveryRemaining: number;
  qualifiesForFreeDelivery: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false });

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);

      if (!saved) return;

      const items = normalizeStoredItems(JSON.parse(saved));

      dispatch({
        type: "LOAD_CART",
        items,
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

      if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items]);

  const subtotal = state.items.reduce(
    (sum, item) => sum + item.finalUnitPrice * item.quantity,
    0
  );

  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const qualifiesForFreeDelivery =
    itemCount > 0 && subtotal >= FREE_DELIVERY_THRESHOLD;
  const deliveryFee =
    itemCount === 0 ? 0 : qualifiesForFreeDelivery ? 0 : DELIVERY_FEE;
  const total = subtotal + deliveryFee;
  const freeDeliveryRemaining =
    itemCount === 0
      ? FREE_DELIVERY_THRESHOLD
      : Math.max(FREE_DELIVERY_THRESHOLD - subtotal, 0);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        isOpen: state.isOpen,
        addItem: (product, options) => {
          const selectedOptions = options?.selectedOptions || [];
          const optionsTotal = Number(options?.optionsTotal ?? 0);
          const finalUnitPrice = Number(
            options?.finalUnitPrice ?? product.price + optionsTotal
          );

          dispatch({
            type: "ADD_ITEM",
            product,
            quantity: options?.quantity ?? 1,
            note: options?.note,
            selectedOptions,
            optionsTotal,
            finalUnitPrice,
          });
        },
        removeItem: (cartItemId) =>
          dispatch({ type: "REMOVE_ITEM", cartItemId }),
        updateQuantity: (cartItemId, quantity) =>
          dispatch({ type: "UPDATE_QUANTITY", cartItemId, quantity }),
        clearCart: () => dispatch({ type: "CLEAR_CART" }),
        toggleCart: () => dispatch({ type: "TOGGLE_CART" }),
        setOpen: (isOpen) => dispatch({ type: "SET_OPEN", isOpen }),
        subtotal,
        deliveryFee,
        total,
        itemCount,
        freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
        freeDeliveryRemaining,
        qualifiesForFreeDelivery,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}