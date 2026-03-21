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
      duration={4200}
      offset="5rem"
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
            "group toast box-border pointer-events-auto flex w-[calc(100vw-1rem)] max-w-[22rem] items-start gap-3 overflow-hidden rounded-2xl border px-3 py-3 text-left text-slate-700 shadow-[0_20px_45px_rgba(15,23,42,0.14)] backdrop-blur sm:max-w-[24rem] sm:px-4 dark:text-slate-200",
          content: "flex min-w-0 flex-1 flex-col gap-1 pr-1 text-left",
          icon:
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current/15 bg-white/80 [&>svg]:h-5 [&>svg]:w-5 dark:bg-slate-950/30",
          title: "break-words text-sm font-semibold leading-5 text-foreground sm:text-[15px]",
          description: "break-words text-xs leading-5 text-muted-foreground sm:text-sm",
          actionButton:
            "mt-2 inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90",
          cancelButton:
            "mt-2 inline-flex h-9 items-center justify-center rounded-xl bg-muted px-4 text-sm font-semibold text-muted-foreground hover:bg-muted/80",
          success:
            "border-emerald-200/90 bg-emerald-50/95 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/75 dark:text-emerald-300",
          error:
            "border-rose-200/90 bg-rose-50/95 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/75 dark:text-rose-300",
          warning:
            "border-amber-200/90 bg-amber-50/95 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/75 dark:text-amber-300",
          info:
            "border-sky-200/90 bg-sky-50/95 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/75 dark:text-sky-300",
          loading:
            "border-primary/20 bg-background/95 text-primary dark:border-primary/30 dark:bg-slate-950/75",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
