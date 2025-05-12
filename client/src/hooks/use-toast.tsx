import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast";
import { useToast as useToastOriginal } from "@/components/ui/use-toast";

type ToastType = Pick<
  ToastProps,
  "title" | "description" | "action" | "className" | "variant"
>;

// Wrap Shadcn Toast to make it easier to use
export function useToast() {
  const { toast, dismiss, toasts } = useToastOriginal();

  return {
    toast: ({ title, description, variant, action, className }: ToastType) => {
      toast({
        title,
        description,
        variant,
        action,
        className,
      });
    },
    dismiss,
    toasts,
  };
}

export { Toast, ToastActionElement, ToastProps };