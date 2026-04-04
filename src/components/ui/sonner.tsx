import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import {
  CheckCircle2,
  Info,
  Loader2,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      visibleToasts={1}
      expand={false}
      duration={2800}
      offset="1rem"
      mobileOffset="1rem"
      closeButton={false}
      className="toaster group"
      icons={{
        success: <CheckCircle2 />,
        error: <XCircle />,
        warning: <TriangleAlert />,
        info: <Info />,
        loading: <Loader2 className="animate-spin" />,
        close: <X />,
      }}
      toastOptions={{
        unstyled: true,
          classNames: {
          toast:
            "group toast w-[calc(100vw-1.25rem)] max-w-[19rem] rounded-xl border px-0 py-0 text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.16)] sm:max-w-[20rem]",
          content: "flex flex-col items-center px-3 pb-3 pt-3 text-center sm:px-4 sm:pb-4 sm:pt-4",
          icon:
            "mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-current/20 bg-current/10 [&>svg]:h-4 [&>svg]:w-4 sm:h-10 sm:w-10 sm:[&>svg]:h-5 sm:[&>svg]:w-5",
          title: "text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg",
          description: "mt-1 text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5",
          actionButton:
            "mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90",
          cancelButton:
            "mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-muted px-4 text-xs font-semibold text-muted-foreground hover:bg-muted/80",
          success:
            "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-300",
          error:
            "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-300",
          warning:
            "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300",
          info:
            "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800/70 dark:bg-yellow-950/40 dark:text-yellow-300",
          loading:
            "border-primary/20 bg-primary/5 text-primary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
