import React, { createContext, useCallback, useContext, useState } from "react";
import { Toast, ToastProps, ToastViewport } from "./toast";
import { generateId } from "@/lib/utils";

type ToastContextType = {
  toasts: Toast[];
  addToast: (toast: Omit<ToastProps, "id">) => string;
  removeToast: (id: string) => void;
  removeAllToasts: () => void;
};

type Toast = ToastProps & {
  id: string;
  timeout?: number;
};

const DEFAULT_TOAST_TIMEOUT = 5000; // 5 seconds

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<ToastProps, "id">) => {
    const id = generateId();
    const timeout = toast.variant === "destructive" ? 8000 : DEFAULT_TOAST_TIMEOUT;
    
    const newToast = { ...toast, id, timeout };
    setToasts((prevToasts) => [...prevToasts, newToast]);
    
    // Auto-remove toast after timeout
    setTimeout(() => {
      removeToast(id);
    }, timeout);
    
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const removeAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, removeAllToasts }}>
      {children}
      <ToastViewport>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </ToastViewport>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};