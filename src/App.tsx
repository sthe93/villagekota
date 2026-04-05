import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import PushNotificationManager from "@/components/PushNotificationManager";
import Navbar from "@/components/Navbar";
import CartDrawer from "@/components/CartDrawer";
import CartFAB from "@/components/CartFAB";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import { Suspense, lazy, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

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

const isCapacitorRuntime =
  typeof window !== "undefined" &&
  (window.location.protocol === "capacitor:" || window.location.href.startsWith("ionic://"));

const normalizedBaseUrl = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

const routerBasename =
  import.meta.env.VITE_ROUTER_BASENAME ||
  (isCapacitorRuntime ? "/" : normalizedBaseUrl);

const preloadPageModules = [
  () => import("./pages/MenuPage"),
  () => import("./pages/CheckoutPage"),
  () => import("./pages/AccountPage"),
  () => import("./pages/AuthPage"),
];

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

function withRouteBoundary(node: React.ReactNode) {
  return <AppErrorBoundary fallbackTitle="This screen failed to load">{node}</AppErrorBoundary>;
}

const App = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
        mozConnection?: { saveData?: boolean; effectiveType?: string };
        webkitConnection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection ||
      (
        navigator as Navigator & {
          mozConnection?: { saveData?: boolean; effectiveType?: string };
        }
      ).mozConnection ||
      (
        navigator as Navigator & {
          webkitConnection?: { saveData?: boolean; effectiveType?: string };
        }
      ).webkitConnection;
    const isConstrainedNetwork =
      Boolean(connection?.saveData) ||
      ["slow-2g", "2g"].includes(connection?.effectiveType ?? "");

    if (isConstrainedNetwork) return;

    const preloadRoutes = () => {
      preloadPageModules.forEach((loader) => {
        void loader();
      });
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preloadRoutes, { timeout: 2000 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(preloadRoutes, 800);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <AppErrorBoundary fallbackTitle="The app failed to render">
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
                    <Route path="/" element={withRouteBoundary(<Index />)} />
                    <Route path="/menu" element={withRouteBoundary(<MenuPage />)} />
                    <Route path="/checkout" element={withRouteBoundary(<CheckoutPage />)} />
                    <Route path="/auth" element={withRouteBoundary(<AuthPage />)} />
                    <Route path="/account" element={withRouteBoundary(<AccountPage />)} />

                    <Route
                      path="/admin"
                      element={withRouteBoundary(
                        <AdminRoute>
                          <AdminPage />
                        </AdminRoute>
                      )}
                    />

                    <Route
                      path="/admin/orders"
                      element={withRouteBoundary(
                        <AdminRoute>
                          <AdminOrdersPage />
                        </AdminRoute>
                      )}
                    />

                    <Route
                      path="/driver"
                      element={withRouteBoundary(
                        <DriverRoute>
                          <DriverPage />
                        </DriverRoute>
                      )}
                    />

                    <Route path="/order-tracking/:orderId" element={withRouteBoundary(<OrderTrackingPage />)} />
                    <Route path="/payment/success" element={withRouteBoundary(<PaymentSuccessPage />)} />
                    <Route path="/payment/cancel" element={withRouteBoundary(<PaymentCancelPage />)} />
                    <Route path="/privacy-policy" element={withRouteBoundary(<PrivacyPolicyPage />)} />
                    <Route path="/terms-of-service" element={withRouteBoundary(<TermsPage />)} />
                    <Route path="/data-disclosure" element={withRouteBoundary(<DataDisclosurePage />)} />
                    <Route path="*" element={withRouteBoundary(<NotFound />)} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </CartProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
};

export default App;
