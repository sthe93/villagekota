import React, { createContext, useContext, useEffect, useReducer } from "react";
import type { Product } from "@/data/products";

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  note?: string;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

interface AddItemOptions {
  quantity?: number;
  note?: string;
}

type CartAction =
  | { type: "ADD_ITEM"; product: Product; quantity: number; note?: string }
  | { type: "REMOVE_ITEM"; cartItemId: string }
  | { type: "UPDATE_QUANTITY"; cartItemId: string; quantity: number }
  | { type: "CLEAR_CART" }
  | { type: "TOGGLE_CART" }
  | { type: "SET_OPEN"; isOpen: boolean }
  | { type: "LOAD_CART"; items: CartItem[] };

const DELIVERY_FEE = 25;
const FREE_DELIVERY_THRESHOLD = 150;

function createCartItemId(productId: string) {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${productId}-${uuid}`;
}

function normalizeStoredItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item: any) => item?.product?.id)
    .map((item: any) => ({
      id:
        typeof item.id === "string" && item.id.trim()
          ? item.id
          : createCartItemId(String(item.product.id)),
      product: item.product,
      quantity: Math.max(1, Number(item.quantity) || 1),
      note:
        typeof item.note === "string" && item.note.trim()
          ? item.note.trim()
          : undefined,
    }));
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const quantityToAdd = Math.max(1, action.quantity || 1);
      const normalizedNote = action.note?.trim() || "";

      const existing = state.items.find(
        (item) =>
          item.product.id === action.product.id &&
          (item.note?.trim() || "") === normalizedNote
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
      const saved = localStorage.getItem("kota-cart");
      if (saved) {
        dispatch({
          type: "LOAD_CART",
          items: normalizeStoredItems(JSON.parse(saved)),
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("kota-cart", JSON.stringify(state.items));
  }, [state.items]);

  const subtotal = state.items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const qualifiesForFreeDelivery = itemCount > 0 && subtotal >= FREE_DELIVERY_THRESHOLD;
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
        addItem: (product, options) =>
          dispatch({
            type: "ADD_ITEM",
            product,
            quantity: options?.quantity ?? 1,
            note: options?.note,
          }),
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