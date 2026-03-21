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
  const normalized = normalizeValue(status);

  switch (normalized) {
    case "confirmed":
    case "preparing":
    case "ready_for_delivery":
    case "on_the_way":
    case "arrived":
    case "delivered":
    case "cancelled":
      return normalized;
    default:
      return "pending";
  }
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
      isUpcoming: true,
      circleClass: "border-border bg-muted text-muted-foreground",
      textClass: "text-muted-foreground",
      connectorTrackClass: "bg-border/90",
      connectorFillClass: "bg-transparent",
      connectorFillWidth: "0%",
    };
  }

  const currentIndex = getDeliveryTimelineIndex(normalized, steps);

  if (stepIndex < currentIndex) {
    return {
      isCompleted: true,
      isCurrent: false,
      isUpcoming: false,
      circleClass:
        "border-emerald-500 bg-emerald-500 text-white shadow-[0_12px_30px_rgba(16,185,129,0.20)]",
      textClass: "text-foreground",
      connectorTrackClass: "bg-emerald-100",
      connectorFillClass: "bg-emerald-500",
      connectorFillWidth: "100%",
    };
  }

  if (stepIndex === currentIndex) {
    return {
      isCompleted: false,
      isCurrent: true,
      isUpcoming: false,
      circleClass:
        "border-primary bg-primary text-primary-foreground ring-8 ring-primary/10 shadow-[0_14px_34px_rgba(180,132,57,0.22)]",
      textClass: "text-foreground",
      connectorTrackClass: "bg-primary/15",
      connectorFillClass: "bg-primary/35",
      connectorFillWidth: "45%",
    };
  }

  return {
    isCompleted: false,
    isCurrent: false,
    isUpcoming: true,
    circleClass: "border-border bg-background text-muted-foreground shadow-sm",
    textClass: "text-muted-foreground",
    connectorTrackClass: "bg-border/90",
    connectorFillClass: "bg-transparent",
    connectorFillWidth: "0%",
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
  const currentIndex = getDeliveryTimelineIndex(normalizedStatus, steps);
  const currentStep = steps[currentIndex] || steps[0];
  const currentStepState = getDeliveryStepState(currentIndex, normalizedStatus, steps);

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
      <div className="mb-7">
        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span>Delivery progress</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-border/90">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="md:hidden">
        <div className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className={[
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-300",
                currentStepState.circleClass,
              ].join(" ")}
            >
              <currentStep.icon className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Current stage
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">{currentStep.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Step {currentIndex + 1} of {steps.length}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const state = getDeliveryStepState(index, normalizedStatus, steps);

            return (
              <div
                key={step.key}
                className={[
                  "rounded-2xl border px-3 py-3 text-center transition-all duration-300",
                  state.isCurrent
                    ? "border-primary bg-primary/5 shadow-sm"
                    : state.isCompleted
                      ? "border-emerald-200 bg-emerald-50/80"
                      : "border-border bg-background",
                ].join(" ")}
              >
                <div
                  className={[
                    "mx-auto flex h-10 w-10 items-center justify-center rounded-full border",
                    state.circleClass,
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className={`mt-2 text-xs font-semibold leading-5 ${state.textClass}`}>
                  {step.shortLabel}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <div className="min-w-[980px] px-2">
            <div className="grid grid-cols-7 items-start">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isLast = index === steps.length - 1;
                const state = getDeliveryStepState(index, normalizedStatus, steps);

                return (
                  <div key={step.key} className="relative px-2 text-center">
                    {!isLast && (
                      <div className="absolute left-1/2 right-[-50%] top-7 z-0">
                        <div
                          className={`h-2 rounded-full ${state.connectorTrackClass}`}
                        >
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${state.connectorFillClass}`}
                            style={{ width: state.connectorFillWidth }}
                          />
                        </div>
                      </div>
                    )}

                    <div
                      className={[
                        "relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-300",
                        state.circleClass,
                      ].join(" ")}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="mt-4 min-h-[64px]">
                      <p className={`text-[15px] font-semibold ${state.textClass}`}>
                        {step.shortLabel}
                      </p>

                      <div className="mt-3 min-h-[24px]">
                        {state.isCurrent && (
                          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                            Current
                          </span>
                        )}

                        {state.isCompleted && (
                          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                            Complete
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
