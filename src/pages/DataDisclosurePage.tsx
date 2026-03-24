import Footer from "@/components/Footer";

export default function DataDisclosurePage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container py-12 md:py-16">
        <h1 className="font-display text-4xl text-foreground">Data Disclosure</h1>
        <p className="mt-3 text-sm text-muted-foreground">For app store compliance (Play Data safety / App Privacy)</p>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <ul className="list-disc space-y-3 pl-5 text-sm leading-7 text-foreground">
            <li><strong>Contact info:</strong> Name, phone, email for account and order fulfilment.</li>
            <li><strong>Location:</strong> Delivery destination coordinates/address for dispatch and tracking.</li>
            <li><strong>Financial info:</strong> Payment status and references (card processing via PayFast).</li>
            <li><strong>User content:</strong> Reviews and support communications.</li>
            <li><strong>Diagnostics:</strong> Operational logs needed for fraud checks and payment reconciliation.</li>
          </ul>

          <p className="mt-5 text-sm text-muted-foreground">
            This disclosure should be mirrored in Apple App Privacy and Google Play Data safety forms before
            production release.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
