import Footer from "@/components/Footer";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container py-12 md:py-16">
        <h1 className="font-display text-4xl text-foreground">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: March 24, 2026</p>

        <div className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6 text-sm leading-7 text-foreground">
          <section>
            <h2 className="text-lg font-semibold">What data we collect</h2>
            <p>
              We collect account details, order information, delivery locations, payment status metadata,
              and customer support communication needed to provide food ordering and delivery services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">How we use data</h2>
            <p>
              Data is used to process orders, dispatch deliveries, provide order updates, maintain account
              preferences, prevent fraud, and meet legal obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Payments</h2>
            <p>
              Card payments are processed through PayFast. We store payment references and status logs needed
              for reconciliation, support, and fraud prevention.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Your choices</h2>
            <p>
              You can update your profile details in-app. To request account deletion, open <strong>My Account</strong>
              and use the <strong>Delete Account</strong> action.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
