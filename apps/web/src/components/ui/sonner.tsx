"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group toast w-full flex items-center gap-3 rounded-lg border p-4 shadow-lg bg-[hsl(0_0%_4%)] border-[hsl(0_0%_15%)] text-[hsl(0_0%_98%)]",
          title: "text-sm font-medium",
          description: "text-sm text-[hsl(0_0%_55%)]",
          actionButton:
            "ml-auto shrink-0 rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-white text-black hover:bg-[hsl(0_0%_90%)] transition-colors",
          cancelButton:
            "ml-auto shrink-0 rounded px-3 py-1.5 text-xs font-medium bg-[hsl(0_0%_10%)] text-[hsl(0_0%_55%)] hover:text-[hsl(0_0%_98%)] transition-colors",
          icon: "shrink-0",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
