import Footer from "@/components/Footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container py-12 md:py-16">
        <h1 className="font-display text-4xl text-foreground">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: March 24, 2026</p>

        <div className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6 text-sm leading-7 text-foreground">
          <section>
            <h2 className="text-lg font-semibold">Use of service</h2>
            <p>
              By placing an order, you agree to provide accurate delivery details, valid contact information,
              and lawful payment methods.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Payments and refunds</h2>
            <p>
              Payment methods include card, EFT, cash on delivery, and voucher flows as offered at checkout.
              Refund handling and disputes follow applicable payment-provider and local consumer rules.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Delivery confirmation</h2>
            <p>
              Delivery completion may require the customer delivery PIN for secure handoff. Orders can be
              marked complete only after verification requirements are met.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Support</h2>
            <p>
              For support, use the contact details shown in the app footer or reach out to
              <strong> hello@villageeats.co.za</strong>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
