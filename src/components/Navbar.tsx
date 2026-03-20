import { ShoppingBag, Menu, X, User, Shield } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import logo from "@/assets/star-village-logo.png";
import { useAuth } from "@/context/AuthContext";
import DriverNavbarBadge from "@/components/DriverNavbarBadge";
import { useState } from "react";

export default function Navbar() {
  const { toggleCart, itemCount } = useCart();
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: "/", label: "Home" },
    { to: "/menu", label: "Menu" },
    { to: "/checkout", label: "Checkout" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-sm backdrop-blur-md">
      <div className="container flex h-20 items-center justify-between">
        <Link to="/" className="flex items-center">
          <img
            src={logo}
            alt="Village Eats"
            className="h-14 w-auto object-contain mix-blend-multiply md:h-16"
          />
        </Link>

        <div className="hidden items-center gap-10 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-lg font-medium transition-colors hover:text-primary ${
                location.pathname === l.to ? "text-primary" : "text-foreground/75"
              }`}
            >
              {l.label}
            </Link>
          ))}
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
            className="relative rounded-lg p-2 transition-colors hover:bg-muted"
            aria-label="Open cart"
          >
            <ShoppingBag className="h-5 w-5 text-foreground" />
            {itemCount > 0 && (
              <span className="animate-scale-in absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {itemCount}
              </span>
            )}
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
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMobileOpen(false)}
              className={`block px-6 py-3 text-sm font-medium transition-colors hover:bg-muted ${
                location.pathname === l.to ? "text-primary" : "text-foreground/75"
              }`}
            >
              {l.label}
            </Link>
          ))}

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
    </nav>
  );
}