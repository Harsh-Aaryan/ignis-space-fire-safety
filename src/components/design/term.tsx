"use client";

import { useId, useState } from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

/**
 * A term with a short definition: dotted underline, definition on hover, keyboard focus or tap.
 * Use at a term's first appearance on a page, with wording the site already uses for it.
 *
 * Built on a tooltip, not a popover: the definition never takes focus, so Tab moves straight on
 * to the next control and keyboard users keep their place.
 */
export function Term({ children, definition, className }: { children: React.ReactNode; definition: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  return (
    <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
      <TooltipPrimitive.Trigger
        delay={200}
        closeDelay={100}
        aria-describedby={descriptionId}
        // A tooltip opens on hover and focus only; a tap toggles it so the definition reaches touch screens too.
        onClick={() => setOpen((value) => !value)}
        // Keyboard focus shows the definition too; a pointer press is left to onClick.
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        className={cn(
          "inline cursor-help rounded-[2px] p-0 text-inherit underline decoration-current/40 decoration-dotted underline-offset-[3px] hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          className,
        )}
      >
        {children}
      </TooltipPrimitive.Trigger>
      {/* The description stays in the DOM so assistive technology reads it with the term, open or not. */}
      <span id={descriptionId} hidden>
        {definition}
      </span>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side="top" sideOffset={6} className="isolate z-50">
          <TooltipPrimitive.Popup role="tooltip" className="max-w-72 rounded-md border border-border bg-popover px-3 py-2 text-[12px] leading-5 text-muted-foreground shadow-md transition-opacity duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0">
            {definition}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
