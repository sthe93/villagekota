import { MapPin, Phone, Mail, Clock } from "lucide-react";
import logo from "@/assets/star-village-logo.png";

export default function Footer() {
  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center mb-5">
            <img
              src={logo}
              alt="Village Eats"
              className="h-16 w-auto object-contain mix-blend-screen"
            />
          </div>

          <p className="text-sm leading-7 text-secondary-foreground/85 font-body max-w-xs">
            Premium Bunny Chow & Kota delivery, inspired by bold local flavour and elevated with a refined Village Eats experience.
          </p>
        </div>

        <div>
          <h4 className="font-display text-2xl mb-4 text-secondary-foreground">CONTACT</h4>
          <div className="space-y-3 text-sm text-secondary-foreground/85">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent shrink-0" />
              <span>123 Durban Road, Johannesburg, 2000</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-accent shrink-0" />
              <span>+27 11 234 5678</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-accent shrink-0" />
              <span>hello@villageeats.co.za</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent shrink-0" />
              <span>Mon – Sun: 10:00 – 22:00</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-display text-2xl mb-4 text-secondary-foreground">QUICK LINKS</h4>
          <div className="space-y-2 text-sm text-secondary-foreground/85">
            <a href="/menu" className="block hover:text-accent transition-colors">Full Menu</a>
            <a href="/checkout" className="block hover:text-accent transition-colors">Checkout</a>
            <a href="#" className="block hover:text-accent transition-colors">Terms & Conditions</a>
            <a href="#" className="block hover:text-accent transition-colors">Privacy Policy</a>
          </div>
        </div>
      </div>

      <div className="border-t border-secondary-foreground/12">
        <div className="container py-4 text-center text-xs text-secondary-foreground/65">
          © {new Date().getFullYear()} Village Eats. All rights reserved. Made with ❤️ in South Africa.
        </div>
      </div>
    </footer>
  );
}