import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const getVariantClasses = () => {
      switch (variant) {
        case "default":
          return "bg-blue-600 text-white hover:bg-blue-700";
        case "destructive":
          return "bg-red-600 text-white hover:bg-red-700";
        case "outline":
          return "border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white";
        case "ghost":
          return "hover:bg-gray-700";
        case "link":
          return "text-blue-600 underline-offset-4 hover:underline";
        default:
          return "bg-blue-600 text-white hover:bg-blue-700";
      }
    };

    const getSizeClasses = () => {
      switch (size) {
        case "default":
          return "h-10 px-4 py-2";
        case "sm":
          return "h-8 px-3 py-1 text-sm";
        case "lg":
          return "h-12 px-6 py-3 text-lg";
        case "icon":
          return "h-10 w-10";
        default:
          return "h-10 px-4 py-2";
      }
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed",
          getVariantClasses(),
          getSizeClasses(),
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };