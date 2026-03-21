import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/data/products";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
    staleTime: 1000 * 60 * 5,
  });
}
