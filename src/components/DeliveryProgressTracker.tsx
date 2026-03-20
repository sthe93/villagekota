import type { ComponentType } from "react";
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  MapPinned,
  PackageCheck,
  Store,
  Truck,
  XCircle,
} from "lucide-react";
import type { OrderStatus } from "@/lib/orderMeta";
import { normalizeValue } from "@/lib/orderMeta";

export type DeliveryStatus = OrderStatus;

export type DeliveryTrackerStep = {
  key: Exclude<OrderStatus, "cancelled">;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
};

export const DEFAULT_DELIVERY_STEPS: DeliveryTrackerStep[] = [
  { key: "pending", label: "Order Placed", shortLabel: "Placed", icon: Clock3 },
  { key: "confirmed", label: "Confirmed", shortLabel: "Confirmed", icon: Store },
  { key: "preparing", label: "Preparing", shortLabel: "Preparing", icon: ChefHat },
  {
    key: "ready_for_delivery",
    label: "Ready for Delivery",
    shortLabel: "Ready",
    icon: PackageCheck,
  },
  { key: "on_the_way", label: "On The Way", shortLabel: "On the Way", icon: Truck },
  { key: "arrived", label: "Arrived", shortLabel: "Arrived", icon: MapPinned },
  { key: "delivered", label: "Delivered", shortLabel: "Delivered", icon: CheckCircle2 },
];

type DeliveryProgressTrackerProps = {
  status: OrderStatus | null | undefined;
  steps?: DeliveryTrackerStep[];
  className?: string;
};

function normalizeStatus(status: string | null | undefined): OrderStatus {
  return (normalizeValue(status) || "pending") as OrderStatus;
}

export function getDeliveryTimelineIndex(
  status: OrderStatus | null | undefined,
  steps: DeliveryTrackerStep[] = DEFAULT_DELIVERY_STEPS
) {
  const normalized = normalizeStatus(status);
  const index = steps.findIndex((step) => step.key === normalized);
  return index === -1 ? 0 : index;
}

export function getDeliveryProgressPercent(
  status: OrderStatus | null | undefined,
  steps: DeliveryTrackerStep[] = DEFAULT_DELIVERY_STEPS
) {
  const normalized = normalizeStatus(status);

  if (normalized === "cancelled") return 0;

  const currentIndex = getDeliveryTimelineIndex(normalized, steps);
  const maxIndex = steps.length - 1;

  if (maxIndex <= 0) return 0;

  return (currentIndex / maxIndex) * 100;
}

export function getDeliveryStepState(
  stepIndex: number,
  currentStatus: OrderStatus | null | undefined,
  steps: DeliveryTrackerStep[] = DEFAULT_DELIVERY_STEPS
) {
  const normalized = normalizeStatus(currentStatus);

  if (normalized === "cancelled") {
    return {
      isCompleted: false,
      isCurrent: false,
      circleClass: "border-border bg-muted text-muted-foreground",
      textClass: "text-muted-foreground",
      connectorFillClass: "bg-border",
    };
  }

  const currentIndex = getDeliveryTimelineIndex(normalized, steps);

  if (stepIndex < currentIndex) {
    return {
      isCompleted: true,
      isCurrent: false,
      circleClass: "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm",
      textClass: "text-foreground",
      connectorFillClass: "bg-emerald-500",
    };
  }

  if (stepIndex === currentIndex) {
    return {
      isCompleted: false,
      isCurrent: true,
      circleClass:
        "border-primary bg-primary text-primary-foreground shadow-[0_0_0_8px_rgba(0,0,0,0.04)]",
      textClass: "text-foreground",
      connectorFillClass: "bg-border",
    };
  }

  return {
    isCompleted: false,
    isCurrent: false,
    circleClass: "border-border bg-background text-muted-foreground",
    textClass: "text-muted-foreground",
    connectorFillClass: "bg-border",
  };
}

export default function DeliveryProgressTracker({
  status,
  steps = DEFAULT_DELIVERY_STEPS,
  className = "",
}: DeliveryProgressTrackerProps) {
  const normalizedStatus = normalizeStatus(status);
  const isCancelled = normalizedStatus === "cancelled";
  const progressPercent = getDeliveryProgressPercent(normalizedStatus, steps);

  if (isCancelled) {
    return (
      <div className={className}>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 text-rose-600" />
            <div>
              <p className="font-medium text-rose-700">Order Cancelled</p>
              <p className="mt-1 text-sm text-rose-600">
                This order has been cancelled and will not continue through the delivery process.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Delivery progress</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[980px] px-1">
          <div className="flex items-start">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === steps.length - 1;
              const state = getDeliveryStepState(index, normalizedStatus, steps);

              return (
                <div key={step.key} className="flex flex-1 items-start">
                  <div className="flex w-full flex-col items-center text-center">
                    <div
                      className={[
                        "flex items-center justify-center rounded-full border transition-all duration-300",
                        state.isCurrent ? "h-14 w-14" : "h-11 w-11",
                        state.circleClass,
                      ].join(" ")}
                    >
                      <Icon className={state.isCurrent ? "h-6 w-6" : "h-5 w-5"} />
                    </div>

                    <div className="mt-3 min-h-[72px]">
                      <p className={`text-sm font-semibold ${state.textClass}`}>
                        {step.shortLabel}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{step.label}</p>

                      {state.isCurrent && (
                        <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                          Current
                        </span>
                      )}

                      {state.isCompleted && (
                        <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                          Complete
                        </span>
                      )}
                    </div>
                  </div>

                  {!isLast && (
                    <div className="flex flex-1 items-center px-2 pt-5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className={`h-full w-full rounded-full ${state.connectorFillClass}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}