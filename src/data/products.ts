import quarterKotaImg from "@/assets/quarter-kota.jpg";
import halfKotaImg from "@/assets/half-kota.jpg";
import fullBunnyImg from "@/assets/full-bunny.jpg";
import chickenBunnyImg from "@/assets/chicken-bunny.jpg";
import beefBunnyImg from "@/assets/beef-bunny.jpg";
import chipsImg from "@/assets/chips.jpg";
import russianImg from "@/assets/russian.jpg";
import drinksImg from "@/assets/drinks.jpg";
import comboMealImg from "@/assets/combo-meal.jpg";

export type Category = "Kota" | "Bunny Chow" | "Sides" | "Drinks" | "Combos";
export type SpiceLevel = "Mild" | "Medium" | "Hot" | "Extra Hot";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  image: string;
  spiceLevel: SpiceLevel;
  isPopular: boolean;
  isFeatured: boolean;
  inStock: boolean;
  rating: number;
  reviewCount: number;
}

export const products: Product[] = [
  {
    id: "quarter-kota",
    name: "Quarter Kota",
    description: "Quarter bread stuffed with golden chips, polony, atchar & our signature sauce. The classic street favourite.",
    price: 35,
    category: "Kota",
    image: quarterKotaImg,
    spiceLevel: "Medium",
    isPopular: true,
    isFeatured: true,
    inStock: true,
    rating: 4.7,
    reviewCount: 234,
  },
  {
    id: "half-kota",
    name: "Half Kota",
    description: "Half loaf packed with chips, russian, polony, cheese & atchar. Double the size, double the flavour.",
    price: 55,
    category: "Kota",
    image: halfKotaImg,
    spiceLevel: "Medium",
    isPopular: true,
    isFeatured: false,
    inStock: true,
    rating: 4.8,
    reviewCount: 189,
  },
  {
    id: "full-bunny-chow",
    name: "Full Bunny Chow",
    description: "A whole hollowed-out loaf filled with our slow-cooked lamb curry. Rich, aromatic & deeply satisfying.",
    price: 75,
    category: "Bunny Chow",
    image: fullBunnyImg,
    spiceLevel: "Hot",
    isPopular: true,
    isFeatured: true,
    inStock: true,
    rating: 4.9,
    reviewCount: 312,
  },
  {
    id: "chicken-bunny",
    name: "Chicken Bunny Chow",
    description: "Half loaf filled with tender chicken pieces in a fragrant golden curry sauce. A Durban classic.",
    price: 65,
    category: "Bunny Chow",
    image: chickenBunnyImg,
    spiceLevel: "Medium",
    isPopular: true,
    isFeatured: true,
    inStock: true,
    rating: 4.8,
    reviewCount: 267,
  },
  {
    id: "beef-bunny",
    name: "Beef Bunny Chow",
    description: "Half loaf filled with slow-braised beef chunks in a rich, dark curry. Hearty and full-bodied.",
    price: 70,
    category: "Bunny Chow",
    image: beefBunnyImg,
    spiceLevel: "Hot",
    isPopular: false,
    isFeatured: false,
    inStock: true,
    rating: 4.7,
    reviewCount: 156,
  },
  {
    id: "chips",
    name: "Chips",
    description: "Thick-cut golden chips, crispy outside, fluffy inside. Perfectly salted.",
    price: 20,
    category: "Sides",
    image: chipsImg,
    spiceLevel: "Mild",
    isPopular: false,
    isFeatured: false,
    inStock: true,
    rating: 4.5,
    reviewCount: 98,
  },
  {
    id: "russian-sausage",
    name: "Russian Sausage",
    description: "Flame-grilled smoky russian sausage. The perfect add-on to any kota.",
    price: 18,
    category: "Sides",
    image: russianImg,
    spiceLevel: "Mild",
    isPopular: false,
    isFeatured: false,
    inStock: true,
    rating: 4.4,
    reviewCount: 76,
  },
  {
    id: "soft-drink",
    name: "Soft Drink",
    description: "Ice cold 330ml can. Choose from Coke, Fanta, Sprite or Stoney.",
    price: 15,
    category: "Drinks",
    image: drinksImg,
    spiceLevel: "Mild",
    isPopular: false,
    isFeatured: false,
    inStock: true,
    rating: 4.3,
    reviewCount: 45,
  },
  {
    id: "kota-combo",
    name: "Kota Combo Deal",
    description: "Quarter Kota + Chips + Soft Drink. The ultimate street food combo at a special price.",
    price: 59,
    category: "Combos",
    image: comboMealImg,
    spiceLevel: "Medium",
    isPopular: true,
    isFeatured: true,
    inStock: true,
    rating: 4.9,
    reviewCount: 445,
  },
  {
    id: "bunny-combo",
    name: "Bunny Chow Combo",
    description: "Chicken Bunny Chow + Russian Sausage + Soft Drink. A feast for one.",
    price: 89,
    category: "Combos",
    image: chickenBunnyImg,
    spiceLevel: "Medium",
    isPopular: true,
    isFeatured: false,
    inStock: true,
    rating: 4.8,
    reviewCount: 198,
  },
];

export const categories: Category[] = ["Kota", "Bunny Chow", "Sides", "Drinks", "Combos"];
