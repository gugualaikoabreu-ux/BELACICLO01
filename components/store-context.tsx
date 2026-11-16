"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/products";

type CartLine = { productId: string; variantId: string; size: string; color: string; quantity: number };
type StoreState = {
  favorites: string[];
  cart: CartLine[];
  viewed: string[];
  catalog: Product[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  addToCart: (productId: string, size?: string, quantity?: number, variantId?: string, color?: string) => void;
  setQuantity: (productId: string, size: string, variantId: string, quantity: number) => void;
  removeFromCart: (productId: string, size: string, variantId: string) => void;
  clearCart: () => void;
  rememberProduct: (productId: string) => void;
  cartCount: number;
};

const StoreContext = createContext<StoreState | null>(null);
const STORAGE_KEY = "belaciclo-store-v1";

export function StoreProvider({ children, catalog }: { children: React.ReactNode; catalog: Product[] }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [viewed, setViewed] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const favoritesRef = useRef(favorites);

  useEffect(() => { favoritesRef.current = favorites; }, [favorites]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const data = JSON.parse(saved) as { favorites?: string[]; cart?: CartLine[]; viewed?: string[] };
          const validIds = new Set(catalog.map((product) => product.id));
          setFavorites(Array.isArray(data.favorites) ? data.favorites.filter((id) => validIds.has(id)) : []);
          setCart(Array.isArray(data.cart) ? data.cart.flatMap((line) => {
            const product = catalog.find((item) => item.id === line.productId);
            const variant = product?.variants.find((item) => item.id === line.variantId)
              ?? product?.variants.find((item) => item.size === line.size && (!line.color || item.color === line.color));
            if (!product || !variant || !Number.isInteger(line.quantity) || line.quantity < 1) return [];
            return [{ ...line, variantId: variant.id, color: variant.color ?? "", size: variant.size ?? "Único", quantity: Math.min(line.quantity, 10) }];
          }) : []);
          setViewed(Array.isArray(data.viewed) ? data.viewed.filter((id) => validIds.has(id)) : []);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    });
  }, [catalog]);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    const sync = async () => {
      try {
        const response = await fetch("/api/favorites", { cache: "no-store" });
        if (!response.ok || !active) return;
        const data = await response.json() as { favorites: string[] };
        const serverIds = new Set(data.favorites);
        const local = favoritesRef.current;
        const localOnly = local.filter((id) => !serverIds.has(id));
        const merged = [...new Set([...data.favorites, ...local])];
        if (merged.length !== local.length || merged.some((id, index) => id !== local[index])) setFavorites(merged);
        await Promise.all(localOnly.map((productId) => fetch("/api/favorites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId }) })));
      } catch { /* Local favorites remain available if the account service is offline. */ }
    };
    void sync();
    window.addEventListener("focus", sync);
    return () => { active = false; window.removeEventListener("focus", sync); };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ favorites, cart, viewed }));
  }, [favorites, cart, viewed, hydrated]);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((current) => {
      const remove = current.includes(productId);
      const next = remove ? current.filter((id) => id !== productId) : [productId, ...current];
      void fetch("/api/favorites", { method: remove ? "DELETE" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId }) }).catch(() => undefined);
      return next;
    });
  }, []);
  const isFavorite = useCallback((productId: string) => favorites.includes(productId), [favorites]);
  const addToCart = useCallback((productId: string, size = "Único", quantity = 1, variantId?: string, color = "") => {
    const product = catalog.find((item) => item.id === productId);
    const variant = product?.variants.find((item) => item.id === variantId)
      ?? product?.variants.find((item) => item.size === size && (!color || item.color === color));
    if (!Number.isInteger(quantity) || quantity < 1 || !variant?.available) return;
    setCart((current) => {
      const existing = current.find((line) => line.variantId === variant.id);
      return existing
        ? current.map((line) => line === existing ? { ...line, quantity: Math.min(10, line.quantity + quantity) } : line)
        : [...current, { productId, variantId: variant.id, size: variant.size ?? "Único", color: variant.color ?? "", quantity: Math.min(10, quantity) }];
    });
  }, [catalog]);
  const setQuantity = useCallback((productId: string, size: string, variantId: string, quantity: number) => {
    const available = catalog.find((product) => product.id === productId)?.variants.some((item) => item.id === variantId && item.available) ?? false;
    setCart((current) => quantity <= 0 || !available ? current.filter((line) => line.variantId !== variantId) : current.map((line) => line.variantId === variantId ? { ...line, quantity: Math.min(10, Math.floor(quantity)) } : line));
  }, [catalog]);
  const removeFromCart = useCallback((productId: string, size: string, variantId: string) => {
    setCart((current) => current.filter((line) => !(line.productId === productId && line.size === size && line.variantId === variantId)));
  }, []);
  const clearCart = useCallback(() => setCart([]), []);
  const rememberProduct = useCallback((productId: string) => {
    setViewed((current) => [productId, ...current.filter((id) => id !== productId)].slice(0, 8));
  }, []);

  const value = useMemo(() => ({ favorites, cart, viewed, catalog, toggleFavorite, isFavorite, addToCart, setQuantity, removeFromCart, clearCart, rememberProduct, cartCount: cart.reduce((sum, line) => sum + line.quantity, 0) }), [favorites, cart, viewed, catalog, toggleFavorite, isFavorite, addToCart, setQuantity, removeFromCart, clearCart, rememberProduct]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore deve ser usado dentro de StoreProvider");
  return context;
}
