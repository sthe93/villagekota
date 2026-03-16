import { MapPin, Phone, Mail, Clock } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="font-display text-3xl text-primary mb-4">KOTA KING</h3>
          <p className="text-sm text-secondary-foreground/70 leading-relaxed">
            South Africa's premium Bunny Chow & Kota delivery. Authentic street food, elevated to perfection.
          </p>
        </div>

        <div>
          <h4 className="font-display text-xl mb-4">CONTACT</h4>
          <div className="space-y-3 text-sm text-secondary-foreground/70">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span>123 Durban Road, Johannesburg, 2000</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary shrink-0" />
              <span>+27 11 234 5678</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary shrink-0" />
              <span>hello@kotaking.co.za</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span>Mon – Sun: 10:00 – 22:00</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-display text-xl mb-4">QUICK LINKS</h4>
          <div className="space-y-2 text-sm text-secondary-foreground/70">
            <a href="/menu" className="block hover:text-primary transition-colors">Full Menu</a>
            <a href="/checkout" className="block hover:text-primary transition-colors">Checkout</a>
            <a href="#" className="block hover:text-primary transition-colors">Terms & Conditions</a>
            <a href="#" className="block hover:text-primary transition-colors">Privacy Policy</a>
          </div>
        </div>
      </div>

      <div className="border-t border-secondary-foreground/10">
        <div className="container py-4 text-center text-xs text-secondary-foreground/50">
          © {new Date().getFullYear()} Kota King. All rights reserved. Made with ❤️ in South Africa.
        </div>
      </div>
    </footer>
  );
}
