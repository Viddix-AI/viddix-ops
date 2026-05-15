"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

/**
 * Tooltip — thin wrapper over @base-ui/react/tooltip.
 *
 * Single-prop API for the 90% case:
 *
 *   <Tooltip content="Open in new tab">
 *     <IconButton icon={<ExternalLink />} />
 *   </Tooltip>
 *
 * For more control (delay, side, align, etc.) drop down to the primitive
 * exports — re-exported here as `TooltipPrimitive` for advanced use.
 */
export function Tooltip({
  content,
  side = "top",
  delay = 200,
  children,
}: {
  /** Tooltip text (or any node — kept short and inline). */
  content: React.ReactNode
  /** Preferred side; flips automatically if no room. */
  side?: "top" | "bottom" | "left" | "right"
  /** Hover delay in ms before showing (matches Linear's ~200ms). */
  delay?: number
  /** The trigger — must be a single focusable element. */
  children: React.ReactNode
}) {
  // base-ui keeps `delay` on Provider (group-shared), not Root. Wrapping each
  // single-use tooltip in its own Provider keeps the simple-API contract.
  return (
    <TooltipPrimitive.Provider delay={delay}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger render={children as React.ReactElement} />
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner side={side} sideOffset={6}>
            <TooltipPrimitive.Popup
              className={cn(
                "z-50 max-w-xs rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md",
                "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
                "transition-opacity duration-150"
              )}
            >
              {content}
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

export { TooltipPrimitive }
