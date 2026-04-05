import {
  ShoppingBag,
  User,
  Shield,
  House,
  UtensilsCrossed,
  Package,
  MapPinned,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import DriverNavbarBadge from "@/components/DriverNavbarBadge";
import appLogo from "@/assets/star-village-logo.png";
import { usePublicAppContentSettings } from "@/lib/appContentSettings";

export default function Navbar() {
  const { toggleCart, itemCount, total } = useCart();
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const appContent = usePublicAppContentSettings();

  const priceFormatter = new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const links = [
    { to: "/", label: "Home", icon: House },
    { to: "/menu", label: "Menu", icon: UtensilsCrossed },
    { to: "/checkout", label: "Cart", icon: ShoppingBag },
    { to: "/account?tab=orders", label: "Track", icon: MapPinned },
  ];

  const mobileNavItems = [
    { to: "/", label: "Home", icon: House },
    { to: "/menu", label: "Menu", icon: UtensilsCrossed },
    { to: "/account?tab=orders", label: "Orders", icon: Package },
    { to: user ? "/account" : "/auth", label: "Account", icon: User },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-sm backdrop-blur-md">
      <div className="container flex h-20 items-center justify-between">
        <Link to="/" className="flex items-center">
          <div className="inline-flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-primary">
            <img
              src={appLogo}
              alt={`${appContent.brand_name} logo`}
              className="h-9 w-9 rounded-full border border-primary/30 bg-black object-cover object-center p-0.5 shadow-sm"
            />
            <span className="text-sm font-semibold tracking-tight md:text-base">{appContent.brand_name}</span>
          </div>
        </Link>

        <div className="hidden items-center gap-10 md:flex">
          {links.map((l) => {
            const Icon = l.icon;
            const isActive =
              l.to === "/account?tab=orders"
                ? location.pathname === "/account" && location.search.includes("tab=orders")
                : location.pathname === l.to;

            return (
              <Link
                key={l.to}
                to={l.to}
                className={`inline-flex items-center gap-2 text-base font-medium transition-colors hover:text-primary ${
                  isActive ? "text-primary" : "text-foreground/75"
                }`}
              >
                <Icon className="h-4 w-4" />
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <DriverNavbarBadge />
          </div>

          {isAdmin && (
            <Link
              to="/admin/orders"
              className="hidden rounded-lg p-2 transition-colors hover:bg-muted md:inline-flex"
              aria-label="Admin Orders"
              title="Admin Orders"
            >
              <Shield className="h-5 w-5 text-primary" />
            </Link>
          )}

          <Link
            to={user ? "/account" : "/auth"}
            className="hidden rounded-lg p-2 transition-colors hover:bg-muted md:inline-flex"
            aria-label={user ? "Account" : "Sign in"}
            title={user ? "My Account" : "Sign In"}
          >
            <User className="h-5 w-5 text-foreground" />
          </Link>

          <button
            onClick={toggleCart}
            className="hidden rounded-lg px-2 py-2 transition-colors hover:bg-muted md:inline-flex"
            aria-label="Open cart"
          >
            <span className="flex items-center gap-2">
              <span className="relative">
                <ShoppingBag className="h-5 w-5 text-foreground" />
                {itemCount > 0 && (
                  <span className="animate-scale-in absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {itemCount}
                  </span>
                )}
              </span>

              {itemCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {priceFormatter.format(total)}
                </span>
              )}
            </span>
          </button>

        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#223149] bg-[#111c2d] px-2 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_-20px_rgba(0,0,0,0.9)] md:hidden">
        <div className="grid grid-cols-5 items-end gap-1">
          {mobileNavItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;

            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex flex-col items-center justify-center rounded-xl py-2 text-[12px] font-semibold transition-colors ${
                  isActive ? "text-[#52c66b]" : "text-white/65"
                }`}
              >
                <Icon className="mb-1 h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <button
            onClick={toggleCart}
            className="relative -mt-9 flex flex-col items-center justify-center rounded-xl py-1 text-[12px] font-semibold text-white/90"
            aria-label="Open cart"
          >
            <span className="mb-1 inline-flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#111c2d] bg-[#4ec062] text-[#0f1f2f] shadow-lg">
              <ShoppingBag className="h-5 w-5" />
            </span>
            Cart
            {itemCount > 0 && (
              <>
                <span className="absolute right-4 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff6a3d] px-1 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
                <span className="mt-0.5 text-[10px] text-[#7de293]">
                  {priceFormatter.format(total)}
                </span>
              </>
            )}
          </button>

          {mobileNavItems.slice(2).map((item) => {
            const Icon = item.icon;
            const target = item.to;
            const isActive =
              item.label === "Orders"
                ? location.pathname === "/account" && location.search.includes("tab=orders")
                : item.label === "Account"
                  ? (location.pathname === "/account" && !location.search.includes("tab=orders")) ||
                    location.pathname === "/auth"
                  : location.pathname === target;

            return (
              <Link
                key={item.label}
                to={target}
                className={`flex flex-col items-center justify-center rounded-xl py-2 text-[12px] font-semibold transition-colors ${
                  isActive ? "text-[#52c66b]" : "text-white/65"
                }`}
              >
                <Icon className="mb-1 h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
