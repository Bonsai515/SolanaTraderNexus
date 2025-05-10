/**
 * Toast Hook
 * 
 * This is a simple toast notification hook using a custom implementation
 * since we don't have shadcn/ui or other toast libraries installed.
 */
import { useState, useCallback } from 'react';

export type ToastVariant = 'default' | 'success' | 'warning' | 'destructive';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface ToastState extends ToastOptions {
  id: string;
  visible: boolean;
}

// Use a global toast array to ensure toasts persist across re-renders
let toasts: ToastState[] = [];
let listeners: Function[] = [];

// Notify all listeners of toast changes
const notifyListeners = () => {
  listeners.forEach(listener => listener(toasts));
};

export function useToast() {
  const [state, setState] = useState<ToastState[]>(toasts);

  // Add listener on mount, remove on unmount
  useState(() => {
    const listener = (newToasts: ToastState[]) => {
      setState([...newToasts]);
    };
    
    listeners.push(listener);
    
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  });

  const toast = useCallback((options: ToastOptions) => {
    const id = Date.now().toString();
    const newToast: ToastState = {
      id,
      title: options.title,
      description: options.description,
      variant: options.variant || 'default',
      duration: options.duration || 5000,
      visible: true
    };
    
    // Add toast
    toasts = [...toasts, newToast];
    notifyListeners();
    
    // Auto-remove after duration
    setTimeout(() => {
      dismissToast(id);
    }, newToast.duration);
    
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    // First mark as not visible for animation
    toasts = toasts.map(t => 
      t.id === id ? { ...t, visible: false } : t
    );
    notifyListeners();
    
    // Then remove after animation completes
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
      notifyListeners();
    }, 300);
  }, []);

  const dismissAllToasts = useCallback(() => {
    // First mark all as not visible
    toasts = toasts.map(t => ({ ...t, visible: false }));
    notifyListeners();
    
    // Then remove after animation completes
    setTimeout(() => {
      toasts = [];
      notifyListeners();
    }, 300);
  }, []);

  return {
    toast,
    dismissToast,
    dismissAllToasts,
    toasts: state
  };
}

export interface UseToastReturn {
  toast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
  dismissAllToasts: () => void;
  toasts: ToastState[];
}

export default useToast;