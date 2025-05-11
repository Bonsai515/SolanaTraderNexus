import * as React from "react";

// Mock implementation of Radix UI Slot primitive
export const Slot: React.FC<React.PropsWithChildren> = ({ children }) => {
  return <>{children}</>;
};