import * as React from "react";

// Mock Radix UI Toast components for the implementation
export const Provider: React.FC<React.PropsWithChildren> = ({ children }) => {
  return <>{children}</>;
};

export const Viewport: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  ...props
}) => {
  return <div {...props}>{children}</div>;
};

export const Root: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  ...props
}) => {
  return <div {...props}>{children}</div>;
};

export const Action: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  ...props
}) => {
  return <button {...props}>{children}</button>;
};

export const Close: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  ...props
}) => {
  return <button {...props}>{children}</button>;
};

export const Title: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  ...props
}) => {
  return <div {...props}>{children}</div>;
};

export const Description: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  ...props
}) => {
  return <div {...props}>{children}</div>;
};