import { ImageOff } from "lucide-react";
import { type ReactNode } from "react";

type ProductRowSummaryProps = {
  imageSrc?: string | null;
  imageAlt: string;
  title: string;
  subtitle?: string;
  imageClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  rightSlot?: ReactNode;
  children?: ReactNode;
};

export default function ProductRowSummary({
  imageSrc,
  imageAlt,
  title,
  subtitle,
  imageClassName = "h-16 w-16 rounded-xl object-cover",
  titleClassName = "truncate font-semibold text-foreground",
  subtitleClassName = "mt-1 text-sm text-muted-foreground",
  rightSlot,
  children,
}: ProductRowSummaryProps) {
  const hasImage = Boolean(imageSrc?.trim());

  return (
    <div className="flex gap-3">
      {hasImage ? (
        <img
          src={imageSrc!}
          alt={imageAlt}
          className={imageClassName}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <ImageOff className="h-4 w-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={titleClassName}>{title}</p>
            {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
          </div>
          {rightSlot}
        </div>
        {children}
      </div>
    </div>
  );
}
