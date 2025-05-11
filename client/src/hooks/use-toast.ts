import * as React from "react";

// Simple toast interface
export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

// Simplified toast hook without JSX
export function useToast() {
  const toast = (props: Omit<Toast, "id">) => {
    // Create a simple notification using browser's built-in alert
    console.log(`[Toast] ${props.variant || 'default'}: ${props.title}${props.description ? ' - ' + props.description : ''}`);
    
    // For actual implementation, we would manage state and render components
    return Math.random().toString(36).slice(2, 9);
  };

  return { toast };
}

// No provider needed with this simplified approach
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  return children;
};