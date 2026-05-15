import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Sparkline — pure-SVG line chart for KPI tiles.
 *
 * No external lib (saves ~30 KB vs. recharts/visx). Inline SVG renders
 * server-side so KPIs paint immediately even before hydration.
 *
 *   <Sparkline data={[0, 4, 8, 9, 11, 14]} width={96} height={28} />
 *
 * `data` is a series of numbers (any length ≥ 2). The line is auto-scaled
 * to the SVG box, padded slightly so peaks don't clip. A subtle area fill
 * sits beneath the line. Tone follows the parent's text colour so each
 * KPIStat can colour its sparkline via `text-success` / `text-destructive`
 * etc. without further props.
 */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  className,
}: {
  data: number[]
  width?: number
  height?: number
  className?: string
}) {
  if (data.length < 2) {
    // Single data point: draw a flat line at the value so the tile still
    // has visual weight. Two points minimum for a meaningful path.
    return (
      <svg
        aria-hidden
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={cn("text-muted-foreground", className)}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.5}
        />
      </svg>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  // Avoid divide-by-zero when every value is identical — render a flat
  // mid-line in that case.
  const span = max - min || 1
  const padY = 2
  const usableH = height - padY * 2

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = padY + usableH - ((v - min) / span) * usableH
    return [x, y] as const
  })

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")

  // Closed area path under the line (line + bottom-right + bottom-left + close).
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("text-muted-foreground", className)}
    >
      <path d={areaPath} fill="currentColor" opacity={0.12} />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Tiny dot on the last point so the trend's endpoint stays legible. */}
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={1.75}
        fill="currentColor"
      />
    </svg>
  )
}
