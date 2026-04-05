import {
  ShoppingBag,
  Menu,
  X,
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
import { useState } from "react";
import appLogo from "@/assets/star-village-logo.png";
import { usePublicAppContentSettings } from "@/lib/appContentSettings";

export default function Navbar() {
  const { toggleCart, itemCount, total } = useCart();
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
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
          <DriverNavbarBadge />

          {isAdmin && (
            <Link
              to="/admin/orders"
              className="rounded-lg p-2 transition-colors hover:bg-muted"
              aria-label="Admin Orders"
              title="Admin Orders"
            >
              <Shield className="h-5 w-5 text-primary" />
            </Link>
          )}

          <Link
            to={user ? "/account" : "/auth"}
            className="rounded-lg p-2 transition-colors hover:bg-muted"
            aria-label={user ? "Account" : "Sign in"}
            title={user ? "My Account" : "Sign In"}
          >
            <User className="h-5 w-5 text-foreground" />
          </Link>

          <button
            onClick={toggleCart}
            className="rounded-lg px-2 py-2 transition-colors hover:bg-muted"
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

          <button
            className="rounded-lg p-2 transition-colors hover:bg-muted md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="animate-fade-in border-t border-border bg-background md:hidden">
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
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors hover:bg-muted ${
                isActive ? "text-primary" : "text-foreground/75"
              }`}
            >
              <Icon className="h-4 w-4" />
              {l.label}
            </Link>
          )})}

          <Link
            to={user ? "/account" : "/auth"}
            onClick={() => setMobileOpen(false)}
            className="block px-6 py-3 text-sm font-medium text-foreground/75 hover:bg-muted"
          >
            {user ? "My Account" : "Sign In"}
          </Link>

          <div onClick={() => setMobileOpen(false)}>
            <DriverNavbarBadge />
          </div>

          {isAdmin && (
            <Link
              to="/admin/orders"
              onClick={() => setMobileOpen(false)}
              className="block px-6 py-3 text-sm font-medium text-primary hover:bg-muted"
            >
              Admin Orders
            </Link>
          )}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-2 py-2 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileNavItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;

            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex flex-col items-center justify-center rounded-lg py-2 text-[11px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-foreground/70"
                }`}
              >
                <Icon className="mb-1 h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <button
            onClick={toggleCart}
            className="relative flex flex-col items-center justify-center rounded-lg py-2 text-[11px] font-medium text-foreground/80"
            aria-label="Open cart"
          >
            <ShoppingBag className="mb-1 h-4 w-4" />
            Cart
            {itemCount > 0 && (
              <>
                <span className="absolute right-4 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {itemCount}
                </span>
                <span className="mt-0.5 text-[10px] text-primary">
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
                className={`flex flex-col items-center justify-center rounded-lg py-2 text-[11px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-foreground/70"
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
