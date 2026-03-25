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
            "group toast w-[calc(100vw-1rem)] max-w-[22rem] rounded-2xl border border-slate-200/80 bg-white px-0 py-0 text-slate-600 shadow-[0_20px_40px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 sm:max-w-[24rem] sm:rounded-3xl",
          content: "flex flex-col items-center px-4 pb-4 pt-4 text-center sm:px-6 sm:pb-6 sm:pt-6",
          icon:
            "mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-current/10 bg-current/5 [&>svg]:h-6 [&>svg]:w-6 sm:h-14 sm:w-14 sm:[&>svg]:h-7 sm:[&>svg]:w-7",
          title: "text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-xl",
          description: "mt-1 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6",
          actionButton:
            "mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90",
          cancelButton:
            "mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-muted px-5 text-sm font-semibold text-muted-foreground hover:bg-muted/80",
          success:
            "text-emerald-600",
          error:
            "text-rose-600",
          warning:
            "text-amber-500",
          info:
            "text-sky-600",
          loading:
            "text-primary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
