import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface DriverRecord {
  id: string;
}

interface OrderRow {
  id: string;
  status: string;
  driver_id: string | null;
}

export default function DriverNavbarBadge() {
  const { user, loading } = useAuth();
  const [driver, setDriver] = useState<DriverRecord | null>(null);
  const [availableCount, setAvailableCount] = useState(0);
  const [checking, setChecking] = useState(true);

  const isReady = useMemo(() => !loading && !checking, [loading, checking]);

  const loadDriverAndCount = useCallback(async () => {
    if (!user) {
      setDriver(null);
      setAvailableCount(0);
      setChecking(false);
      return;
    }

    setChecking(true);

    const { data: driverData } = await supabase
      .from("drivers")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!driverData) {
      setDriver(null);
      setAvailableCount(0);
      setChecking(false);
      return;
    }

    setDriver(driverData as DriverRecord);

    const { data: orderData } = await supabase
      .from("orders")
      .select("id, status, driver_id")
      .eq("status", "ready_for_delivery")
      .is("driver_id", null);

    const rows = (orderData || []) as OrderRow[];
    setAvailableCount(rows.length);
    setChecking(false);
  }, [user]);

  useEffect(() => {
    if (!loading) {
      void loadDriverAndCount();
    }
  }, [loading, loadDriverAndCount]);

  useEffect(() => {
    if (!driver) return;

    const channel = supabase
      .channel("driver-navbar-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        async () => {
          const { data } = await supabase
            .from("orders")
            .select("id, status, driver_id")
            .eq("status", "ready_for_delivery")
            .is("driver_id", null);

          const rows = (data || []) as OrderRow[];
          setAvailableCount(rows.length);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driver]);

  if (loading || checking) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!user || !driver || !isReady) return null;

  return (
    <Link
      to="/driver"
      className="relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
    >
      <Truck className="h-4 w-4" />
      Driver

      {availableCount > 0 && (
        <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
          {availableCount}
        </span>
      )}
    </Link>
  );
}
