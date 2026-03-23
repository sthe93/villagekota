import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquareText, Star, Truck } from "lucide-react";
import type { DriverInfo, OrderItemRecord, OrderRecord } from "@/features/order-tracking/types";
import { toast } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchOrderReviewData,
  saveOrderReviewData,
  type DriverReviewRecord,
  type ProductReviewRecord,
  type ReviewableProduct,
} from "@/lib/reviews";
import { cn } from "@/lib/utils";

interface RatingInput {
  rating: number;
  comment: string;
}

interface OrderReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderRecord | null;
  items: OrderItemRecord[];
  driver: DriverInfo | null;
  userId: string | null;
  onSubmitted?: () => void | Promise<void>;
}

function RatingStars({
  label,
  rating,
  onChange,
}: {
  label: string;
  rating: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, index) => {
          const value = index + 1;
          const active = value <= rating;

          return (
            <button
              key={value}
              type="button"
              aria-label={`${label}: ${value} star${value === 1 ? "" : "s"}`}
              onClick={() => onChange(value)}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors",
                active
                  ? "border-amber-300 bg-amber-50 text-amber-500"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <Star className={cn("h-5 w-5", active && "fill-current")} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  description,
  icon,
  value,
  onChange,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  value: RatingInput;
  onChange: (next: RatingInput) => void;
}) {
  const Icon = icon;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>

          <RatingStars label={title} rating={value.rating} onChange={(rating) => onChange({ ...value, rating })} />

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Comment</p>
            <Textarea
              value={value.comment}
              onChange={(event) => onChange({ ...value, comment: event.target.value })}
              rows={3}
              placeholder="Optional feedback"
              className="min-h-[96px] resize-y"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderReviewDialog({
  open,
  onOpenChange,
  order,
  items,
  driver,
  userId,
  onSubmitted,
}: OrderReviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewableProducts, setReviewableProducts] = useState<ReviewableProduct[]>([]);
  const [productInputs, setProductInputs] = useState<Record<string, RatingInput>>({});
  const [driverInput, setDriverInput] = useState<RatingInput>({ rating: 0, comment: "" });

  const hasReviewTargets = useMemo(
    () => reviewableProducts.length > 0 || Boolean(driver?.id),
    [driver?.id, reviewableProducts.length]
  );

  useEffect(() => {
    if (!open || !order || !userId) return;

    let active = true;

    const load = async () => {
      setLoading(true);

      try {
        const data = await fetchOrderReviewData({
          orderId: order.id,
          userId,
          items,
        });

        if (!active) return;

        setReviewableProducts(data.products);

        const nextProductInputs = data.products.reduce<Record<string, RatingInput>>((acc, product) => {
          const existing = data.productReviews.find((review) => review.product_id === product.productId);
          acc[product.productId] = {
            rating: existing?.rating ?? 0,
            comment: existing?.comment ?? "",
          };
          return acc;
        }, {});

        setProductInputs(nextProductInputs);
        setDriverInput({
          rating: data.driverReview?.rating ?? 0,
          comment: data.driverReview?.comment ?? "",
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load review form");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [open, order, userId, items]);

  const handleSave = async () => {
    if (!order || !userId) return;

    const hasFoodRating = Object.values(productInputs).some((input) => input.rating > 0);
    const hasDriverRating = driverInput.rating > 0;

    if (!hasFoodRating && !hasDriverRating) {
      toast.error("Add at least one rating before saving your review.");
      return;
    }

    setSaving(true);

    try {
      await saveOrderReviewData({
        order,
        userId,
        products: reviewableProducts,
        productRatings: productInputs,
        driver,
        driverRating: driverInput,
      });

      toast.success("Thanks for sharing your feedback.");
      await onSubmitted?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save your review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Rate your order</DialogTitle>
          <DialogDescription>
            Leave feedback on the food and your delivery experience so we can improve quality and build trust.
          </DialogDescription>
        </DialogHeader>

        {!userId ? (
          <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
            Sign in to rate delivered orders.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-3 text-sm">Loading review form...</span>
          </div>
        ) : !hasReviewTargets ? (
          <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
            This order does not have any reviewable food items or an assigned delivery driver.
          </div>
        ) : (
          <div className="space-y-4">
            {reviewableProducts.map((product) => (
              <ReviewSection
                key={product.productId}
                title={product.productName}
                description="Rate the food quality, flavour, and overall satisfaction for this item."
                icon={MessageSquareText}
                value={productInputs[product.productId] ?? { rating: 0, comment: "" }}
                onChange={(next) =>
                  setProductInputs((current) => ({
                    ...current,
                    [product.productId]: next,
                  }))
                }
              />
            ))}

            {driver?.id && (
              <ReviewSection
                title={driver.name}
                description="Rate your delivery person on professionalism, communication, and handling of the order."
                icon={Truck}
                value={driverInput}
                onChange={setDriverInput}
              />
            )}

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : "Save review"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
