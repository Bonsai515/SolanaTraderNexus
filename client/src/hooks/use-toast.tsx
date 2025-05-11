import * as React from "react";

export type ToastVariant = "default" | "destructive" | "success" | "warning" | "info";

export type ToastState = {
  id: string;
  title?: string;
  description?: string;
  visible: boolean;
  variant?: ToastVariant;
  duration?: number;
}

export type ToastActionElement = React.ReactElement;

export const TOAST_REMOVE_DELAY = 3000;

interface ToastContextValue {
  toasts: ToastState[];
  toast: (props: Omit<ToastState, "id" | "visible">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

function genId() {
  return Math.random().toString(36).substring(2, 9);
}

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = React.useState<ToastState[]>([]);

  const toast = React.useCallback(
    ({ ...props }: Omit<ToastState, "id" | "visible">) => {
      const id = genId();

      setToasts((prevToasts) => [
        ...prevToasts,
        { id, visible: true, ...props },
      ]);

      return id;
    },
    []
  );

  const dismiss = React.useCallback((id: string) => {
    setToasts((prevToasts) =>
      prevToasts.map((toast) =>
        toast.id === id ? { ...toast, visible: false } : toast
      )
    );

    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
    }, TOAST_REMOVE_DELAY);
  }, []);

  const value = React.useMemo(
    () => ({ toasts, toast, dismiss }),
    [toasts, toast, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}