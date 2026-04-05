import { MapPin, Phone, Mail, Clock, UtensilsCrossed, ShoppingBag, Package, FileText, ShieldCheck, Database } from "lucide-react";
import { Link } from "react-router-dom";
import appLogo from "@/assets/star-village-logo.png";
import { usePublicAppContentSettings } from "@/lib/appContentSettings";

export default function Footer() {
  const appContent = usePublicAppContentSettings();

  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center mb-5">
            <div className="inline-flex items-center gap-3 rounded-xl border border-secondary-foreground/20 bg-secondary-foreground/10 px-3 py-2">
              <img
                src={appLogo}
                alt={`${appContent.brand_name} logo`}
                className="h-9 w-9 rounded-full border border-secondary-foreground/30 bg-black object-cover object-center p-0.5 shadow-sm"
              />
              <span className="text-base font-semibold tracking-tight text-secondary-foreground">
                {appContent.brand_name}
              </span>
            </div>
          </div>

          <p className="text-sm leading-7 text-secondary-foreground/85 font-body max-w-xs">
            {appContent.footer_description}
          </p>
        </div>

        <div>
          <h4 className="font-display text-2xl mb-4 text-secondary-foreground">CONTACT</h4>
          <div className="space-y-3 text-sm text-secondary-foreground/85">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent shrink-0" />
              <span>{appContent.contact_address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-accent shrink-0" />
              <span>{appContent.contact_phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-accent shrink-0" />
              <span>{appContent.contact_email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent shrink-0" />
              <span>{appContent.business_hours}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-display text-2xl mb-4 text-secondary-foreground">QUICK LINKS</h4>
          <div className="space-y-2 text-sm text-secondary-foreground/85">
            <Link to="/menu" className="flex items-center gap-2 hover:text-accent transition-colors">
              <UtensilsCrossed className="h-4 w-4" /> Menu
            </Link>
            <Link to="/checkout" className="flex items-center gap-2 hover:text-accent transition-colors">
              <ShoppingBag className="h-4 w-4" /> Cart
            </Link>
            <Link to="/account?tab=orders" className="flex items-center gap-2 hover:text-accent transition-colors">
              <Package className="h-4 w-4" /> Track
            </Link>
            <Link to="/terms-of-service" className="flex items-center gap-2 hover:text-accent transition-colors">
              <FileText className="h-4 w-4" /> Terms
            </Link>
            <Link to="/privacy-policy" className="flex items-center gap-2 hover:text-accent transition-colors">
              <ShieldCheck className="h-4 w-4" /> Privacy
            </Link>
            <Link to="/data-disclosure" className="flex items-center gap-2 hover:text-accent transition-colors">
              <Database className="h-4 w-4" /> Data
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-secondary-foreground/12">
        <div className="container py-4 text-center text-xs text-secondary-foreground/65">
          © {new Date().getFullYear()} {appContent.brand_name}. All rights reserved. Made with ❤️ in South Africa.
        </div>
      </div>
    </footer>
  );
}
