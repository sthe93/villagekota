import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      richColors
      position="top-right"
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast border shadow-lg rounded-2xl",
          title: "text-sm font-semibold",
          description: "text-sm opacity-90",
          actionButton:
            "bg-primary text-primary-foreground hover:opacity-90",
          cancelButton:
            "bg-muted text-muted-foreground hover:bg-muted/80",
          success:
            "border-emerald-200 bg-emerald-50 text-emerald-900",
          error:
            "border-rose-200 bg-rose-50 text-rose-900",
          warning:
            "border-amber-200 bg-amber-50 text-amber-900",
          info:
            "border-sky-200 bg-sky-50 text-sky-900",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };