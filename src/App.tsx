import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import PushNotificationManager from "@/components/PushNotificationManager";
import Navbar from "@/components/Navbar";
import CartDrawer from "@/components/CartDrawer";
import CartFAB from "@/components/CartFAB";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import "maplibre-gl/dist/maplibre-gl.css";
import { Loader2 } from "lucide-react";
import { Suspense, lazy } from "react";

const MenuPage = lazy(() => import("./pages/MenuPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const OrderTrackingPage = lazy(() => import("./pages/OrderTrackingPage"));
const AdminOrdersPage = lazy(() => import("@/pages/AdminOrdersPage"));
const DriverPage = lazy(() => import("@/pages/DriverPage"));
const PaymentSuccessPage = lazy(() => import("./pages/PaymentSuccessPage"));
const PaymentCancelPage = lazy(() => import("./pages/PaymentCancelPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const DataDisclosurePage = lazy(() => import("./pages/DataDisclosurePage"));

const queryClient = new QueryClient();


const isCapacitorRuntime =
  typeof window !== "undefined" &&
  (window.location.protocol === "capacitor:" || window.location.href.startsWith("ionic://"));

const routerBasename =
  import.meta.env.VITE_ROUTER_BASENAME ||
  (isCapacitorRuntime ? "/" : import.meta.env.DEV ? "/" : "/villagekota");

function FullScreenLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border/80 bg-card/95 px-8 py-7 text-center shadow-card backdrop-blur-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">Please wait a moment.</p>
        </div>
      </div>
    </div>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function DriverRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isDriver } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isDriver) return <Navigate to="/" replace />;

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AuthProvider>
        <PushNotificationManager />
        <CartProvider>
          <BrowserRouter basename={routerBasename}>
            <Navbar />
            <CartDrawer />
            <CartFAB />

            <Suspense fallback={<FullScreenLoader label="Loading page" />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/account" element={<AccountPage />} />

                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminPage />
                    </AdminRoute>
                  }
                />

                <Route
                  path="/admin/orders"
                  element={
                    <AdminRoute>
                      <AdminOrdersPage />
                    </AdminRoute>
                  }
                />

                <Route
                  path="/driver"
                  element={
                    <DriverRoute>
                      <DriverPage />
                    </DriverRoute>
                  }
                />

                <Route path="/order-tracking/:orderId" element={<OrderTrackingPage />} />
                <Route path="/payment/success" element={<PaymentSuccessPage />} />
                <Route path="/payment/cancel" element={<PaymentCancelPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                <Route path="/terms-of-service" element={<TermsPage />} />
                <Route path="/data-disclosure" element={<DataDisclosurePage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
