import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { 
  cva as originalCva, 
  type VariantProps as OriginalVariantProps 
} from "class-variance-authority"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export const cva = originalCva;
export type VariantProps<T extends (...args: any) => any> = OriginalVariantProps<T>;