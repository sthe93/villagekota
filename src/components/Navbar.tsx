import { ShoppingBag, Menu, X, User, Shield } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import logo from "@/assets/star-village-logo.png";
import { useAuth } from "@/context/AuthContext";
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
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="container flex items-center justify-between h-20">
        <Link to="/" className="flex items-center">
          <img
            src={logo}
            alt="Village Eats"
            className="h-14 md:h-16 w-auto object-contain mix-blend-multiply"
          />
        </Link>

        <div className="hidden md:flex items-center gap-10">
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
          {isAdmin && (
            <Link
              to="/admin/orders"
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Admin Orders"
            >
              <Shield className="w-5 h-5 text-primary" />
            </Link>
          )}

          <Link
            to={user ? "/account" : "/auth"}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label={user ? "Account" : "Sign in"}
          >
            <User className="w-5 h-5 text-foreground" />
          </Link>

          <button
            onClick={toggleCart}
            className="relative p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Open cart"
          >
            <ShoppingBag className="w-5 h-5 text-foreground" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center animate-scale-in">
                {itemCount}
              </span>
            )}
          </button>

          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background animate-fade-in">
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