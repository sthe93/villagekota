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
      offset="18vh"
      mobileOffset="12vh"
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
        classNames: {
          toast:
            "group toast w-[calc(100vw-2rem)] max-w-[26rem] rounded-[28px] border border-slate-200/80 bg-white px-0 py-0 text-slate-600 shadow-[0_28px_70px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
          content: "flex flex-col items-center px-7 pb-7 pt-8 text-center",
          icon:
            "mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-current/10 bg-current/5 [&>svg]:h-8 [&>svg]:w-8",
          title: "text-2xl font-semibold tracking-tight text-foreground",
          description: "mt-1 text-sm leading-6 text-muted-foreground",
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
