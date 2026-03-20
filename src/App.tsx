import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import CartDrawer from "@/components/CartDrawer";
import CartFAB from "@/components/CartFAB";
import Index from "./pages/Index";
import MenuPage from "./pages/MenuPage";
import CheckoutPage from "./pages/CheckoutPage";
import AuthPage from "./pages/AuthPage";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import AdminOrdersPage from "@/pages/AdminOrdersPage";
import DriverPage from "@/pages/DriverPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PaymentCancelPage from "./pages/PaymentCancelPage";
import NotFound from "./pages/NotFound";
import "maplibre-gl/dist/maplibre-gl.css";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function DriverRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const [checkingDriver, setCheckingDriver] = useState(true);
  const [isDriver, setIsDriver] = useState(false);

  useEffect(() => {
    const checkDriver = async () => {
      if (!user) {
        setIsDriver(false);
        setCheckingDriver(false);
        return;
      }

      const { data, error } = await supabase
        .from("drivers")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        setIsDriver(false);
      } else {
        setIsDriver(!!data);
      }

      setCheckingDriver(false);
    };

    if (!loading) {
      checkDriver();
    }
  }, [user, loading]);

  if (loading || checkingDriver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (!isDriver) return <Navigate to="/" replace />;

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AuthProvider>
        <CartProvider>
          <BrowserRouter basename={import.meta.env.DEV ? "/" : "/villagekota"}>
            <Navbar />
            <CartDrawer />
            <CartFAB />

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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;