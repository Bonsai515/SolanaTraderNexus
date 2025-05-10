/**
 * Toast Component
 * 
 * This is a simple toast notification component
 */
import { useState, useEffect } from 'react';
import { ToastState, useToast } from '../../hooks/use-toast';

export function Toasts() {
  const { toasts, dismissToast } = useToast();
  
  if (toasts.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-md">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  );
}

interface ToastProps {
  toast: ToastState;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  // Animation on mount
  useEffect(() => {
    // Small delay to ensure the transition works
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 10);
    return () => clearTimeout(timer);
  }, []);
  
  // Handle animation when removed
  useEffect(() => {
    if (!toast.visible) {
      setIsVisible(false);
    }
  }, [toast.visible]);
  
  // Determine the background color based on variant
  const getVariantClass = () => {
    switch (toast.variant) {
      case 'success':
        return 'bg-green-500/90 text-white';
      case 'warning':
        return 'bg-yellow-500/90 text-white';
      case 'destructive':
        return 'bg-red-500/90 text-white';
      default:
        return 'bg-blue-500/90 text-white';
    }
  };
  
  return (
    <div 
      className={`rounded-lg shadow-lg p-4 transform transition-all duration-200 ease-in-out ${
        getVariantClass()
      } ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium">{toast.title}</h3>
          {toast.description && (
            <p className="text-sm opacity-90 mt-1">{toast.description}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="ml-4 text-white/80 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default Toasts;