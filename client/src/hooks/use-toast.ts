import React, { createContext, useCallback, useContext, useState } from "react";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
}

type ToastContextType = {
  toasts: Toast[];
  toast: (props: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
};

const DEFAULT_TOAST_DURATION = 5000; // 5 seconds

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((props: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    const duration = props.duration || DEFAULT_TOAST_DURATION;
    
    const newToast = { ...props, id };
    setToasts((prevToasts) => [...prevToasts, newToast]);
    
    // Auto-remove toast after duration
    setTimeout(() => {
      dismiss(id);
    }, duration);
    
    // Also log to console for debugging
    console.log(`[Toast] ${props.variant || 'default'}: ${props.title}${props.description ? ' - ' + props.description : ''}`);
    
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Implement a simpler version without JSX for compatibility
  // Return the provider
  const value = { toasts, toast, dismiss, dismissAll };
  return children;
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}