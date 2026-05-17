import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Sparkline — pure-SVG line chart for KPI tiles.
 *
 * No external lib (saves ~30 KB vs. recharts/visx). Inline SVG renders
 * server-side so KPIs paint immediately even before hydration. Line-only by
 * default; pass `fill` to add a subtle area beneath. Width and height accept
 * either numeric pixels or `"100%"` so the chart can fill its KPI card.
 */
export function Sparkline({
  data,
  width = "100%",
  height = 40,
  fill = false,
  className,
}: {
  data: number[]
  width?: number | string
  height?: number | string
  fill?: boolean
  className?: string
}) {
  // Internal viewBox is fixed so points map cleanly regardless of CSS-driven
  // outer width/height. preserveAspectRatio="none" lets the SVG stretch.
  const vbW = 100
  const vbH = 40

  if (data.length < 2) {
    return (
      <svg
        aria-hidden
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="none"
        width={width}
        height={height}
        className={cn("text-chart-1", className)}
      >
        <line
          x1={0}
          y1={vbH / 2}
          x2={vbW}
          y2={vbH / 2}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const padY = 2
  const usableH = vbH - padY * 2

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * vbW
    const y = padY + usableH - ((v - min) / span) * usableH
    return [x, y] as const
  })

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")
  const areaPath = `${linePath} L ${vbW} ${vbH} L 0 ${vbH} Z`

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="none"
      width={width}
      height={height}
      className={cn("text-chart-1", className)}
    >
      {fill && <path d={areaPath} fill="currentColor" opacity={0.08} />}
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
