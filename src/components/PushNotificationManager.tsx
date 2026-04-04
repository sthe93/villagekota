import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  buildAdminOrderNotification,
  buildDriverDispatchNotification,
  buildOrderNotification,
  buildPaymentNotification,
  getPushNotificationPermissionState,
  registerNativePushToken,
  registerPushNotificationsServiceWorker,
  showAppNotification,
} from "@/lib/pushNotifications";

type OrderEventRecord = {
  id?: string;
  status?: string | null;
  payment_status?: string | null;
  user_id?: string | null;
  driver_id?: string | null;
};

type DriverRecord = {
  id: string;
};

export default function PushNotificationManager() {
  const { user, isAdmin, isDriver } = useAuth();
  const driverIdRef = useRef<string | null>(null);

  useEffect(() => {
    void registerPushNotificationsServiceWorker();
  }, []);

  useEffect(() => {
    if (!user || !isDriver) {
      driverIdRef.current = null;
      return;
    }

    let cancelled = false;

    void supabase
      .from("drivers")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          driverIdRef.current = (data as DriverRecord | null)?.id ?? null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, isDriver]);


  useEffect(() => {
    if (!user || !getPushNotificationPermissionState().enabled) return;

    let cancelled = false;

    void (async () => {
      try {
        const registration = await registerNativePushToken();
        if (!registration || cancelled) return;

        const role = isAdmin ? "admin" : isDriver ? "driver" : "customer";

        const { error } = await supabase.functions.invoke("register-push-device", {
          body: {
            token: registration.token,
            platform: registration.platform,
            role,
            enabled: true,
          },
        });

        if (error) {
          console.warn("Failed to register native push token", error.message);
        }
      } catch (error) {
        console.warn("Failed to register native push token", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isAdmin, isDriver]);

  useEffect(() => {
    if (!user) return;
    if (!getPushNotificationPermissionState().enabled) return;

    const customerChannel = supabase
      .channel(`push-customer-orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const next = (payload.new ?? null) as OrderEventRecord | null;
          const previous = (payload.old ?? null) as OrderEventRecord | null;

          if (!next?.id) return;

          if (payload.eventType === "INSERT" && next.status) {
            const notification = buildOrderNotification({
              orderId: next.id,
              status: next.status,
            });

            if (notification) {
              await showAppNotification(notification);
            }
            return;
          }

          if (next.status && next.status !== previous?.status) {
            const notification = buildOrderNotification({
              orderId: next.id,
              status: next.status,
            });

            if (notification) {
              await showAppNotification(notification);
            }
            return;
          }

          if (next.payment_status && next.payment_status !== previous?.payment_status) {
            const notification = buildPaymentNotification({
              orderId: next.id,
              paymentStatus: next.payment_status,
            });

            if (notification) {
              await showAppNotification(notification);
            }
          }
        }
      )
      .subscribe();

    const roleChannel = supabase
      .channel(`push-role-orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          const next = (payload.new ?? null) as OrderEventRecord | null;
          const previous = (payload.old ?? null) as OrderEventRecord | null;

          if (!next?.id) return;

          if (isAdmin && payload.eventType === "INSERT") {
            await showAppNotification(buildAdminOrderNotification(next.id));
            return;
          }

          if (
            isDriver &&
            next.status === "ready_for_delivery" &&
            previous?.status !== "ready_for_delivery" &&
            !next.driver_id
          ) {
            await showAppNotification(buildDriverDispatchNotification(next.id));
            return;
          }

          if (
            isDriver &&
            driverIdRef.current &&
            next.driver_id === driverIdRef.current &&
            next.status &&
            next.status !== previous?.status
          ) {
            const notification = buildOrderNotification({
              orderId: next.id,
              status: next.status,
            });

            if (notification) {
              await showAppNotification({
                ...notification,
                audience: "driver",
                url: "/driver",
                tag: `driver-assigned-${next.id}-${next.status}`,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(customerChannel);
      void supabase.removeChannel(roleChannel);
    };
  }, [user, isAdmin, isDriver]);

  return null;
}
