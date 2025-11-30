"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const PopoverContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({
  open: false,
  onOpenChange: () => {},
});

export function Popover({ open = false, onOpenChange, children }: PopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(open);

  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  React.useEffect(() => {
    if (open !== undefined) {
      setInternalOpen(open);
    }
  }, [open]);

  return (
    <PopoverContext.Provider value={{ open: isOpen, onOpenChange: setIsOpen }}>
      <div className="relative">{children}</div>
    </PopoverContext.Provider>
  );
}

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
  const { open, onOpenChange } = React.useContext(PopoverContext);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      ...props,
      onClick: () => onOpenChange(!open),
      ref,
    });
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpenChange(!open)}
      className={cn(className)}
      {...props}
    >
      {children}
    </button>
  );
});
PopoverTrigger.displayName = "PopoverTrigger";

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
  }
>(({ className, align = "start", side = "bottom", children, ...props }, ref) => {
  const { open, onOpenChange } = React.useContext(PopoverContext);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        onOpenChange(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={contentRef}
        className={cn(
          "absolute z-50 w-72 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900",
          {
            "left-0": align === "start",
            "left-1/2 -translate-x-1/2": align === "center",
            "right-0": align === "end",
            "top-full mt-2": side === "bottom",
            "bottom-full mb-2": side === "top",
            "left-full ml-2": side === "right",
            "right-full mr-2": side === "left",
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    </>
  );
});
PopoverContent.displayName = "PopoverContent";

export { PopoverTrigger, PopoverContent };
