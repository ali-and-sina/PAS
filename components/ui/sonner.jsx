"use client";

import { Toaster as Sonner } from "sonner";

const Toaster = ({ visibleToasts = 3, duration = 4500, closeButton = true, ...props }) => (
  <Sonner
    theme="light"
    position="top-center"
    visibleToasts={visibleToasts}
    duration={duration}
    closeButton={closeButton}
    className="toaster group"
    toastOptions={{
      classNames: {
        toast: "group toast group-[.toaster]:border-border group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-pas-3",
        title: "font-semibold",
        description: "group-[.toast]:text-muted-foreground",
        success: "group-[.toast]:border-success/30",
        error: "group-[.toast]:border-destructive/35",
        warning: "group-[.toast]:border-warning/35",
        info: "group-[.toast]:border-info/35",
        actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
        cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        closeButton: "group-[.toast]:border-border group-[.toast]:bg-background group-[.toast]:text-muted-foreground",
      },
    }}
    {...props}
  />
);

export { Toaster };
