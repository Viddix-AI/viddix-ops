import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * PieChart — pure-SVG donut for dashboard segmentation widgets.
 *
 * Mirrors the `Sparkline` precedent: inline SVG, no external lib, server-
 * renderable. Each slice's colour cycles through the editorial chart palette
 * (`--chart-1..5`) so the surrounding legend can match by index via the
 * exported `PIE_FILL_CLASSES` / `PIE_TEXT_CLASSES` lookups.
 *
 * Special cases:
 *   - 0 slices or total === 0: renders a faint ring placeholder.
 *   - exactly 1 non-zero slice: renders a full `<circle>` (SVG arc with
 *     coincident endpoints would otherwise draw nothing).
 */

export type PieDatum = {
  /** stable id, used as React key and surfaced to the legend */
  key: string
  /** human label for the legend */
  label: string
  /** non-negative numeric weight */
  value: number
}

// Cycle through the editorial chart tokens — jade / plum / ochre / graphite /
// terracota. Five entries: more than five slices will reuse the first colours.
export const PIE_FILL_CLASSES = [
  "fill-chart-1",
  "fill-chart-2",
  "fill-chart-3",
  "fill-chart-4",
  "fill-chart-5",
] as const

export const PIE_TEXT_CLASSES = [
  "text-chart-1",
  "text-chart-2",
  "text-chart-3",
  "text-chart-4",
  "text-chart-5",
] as const

export function pieToneFor(i: number): {
  fill: typeof PIE_FILL_CLASSES[number]
  text: typeof PIE_TEXT_CLASSES[number]
} {
  const idx = i % PIE_FILL_CLASSES.length
  return { fill: PIE_FILL_CLASSES[idx], text: PIE_TEXT_CLASSES[idx] }
}

export function PieChart({
  data,
  size = 160,
  thickness = 36,
  className,
}: {
  data: PieDatum[]
  size?: number
  thickness?: number
  className?: string
}) {
  const total = data.reduce((s, d) => s + (d.value > 0 ? d.value : 0), 0)
  // viewBox is fixed at 100x100 so internal geometry is unit-independent;
  // the SVG itself is sized via the `size` prop (or full container width).
  const r = 50
  const ri = Math.max(10, r - (thickness / size) * 100)
  const cx = 50
  const cy = 50

  // Placeholder ring — no data or all-zero slices.
  if (total === 0 || data.length === 0) {
    return (
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={cn("text-text-tertiary", className)}
        role="img"
        aria-label="No data"
      >
        <circle
          cx={cx}
          cy={cy}
          r={(r + ri) / 2}
          fill="none"
          stroke="currentColor"
          strokeWidth={r - ri}
          opacity={0.12}
        />
      </svg>
    )
  }

  // One non-zero slice → full ring of that colour. SVG arc with start === end
  // would draw nothing, so this is a separate code path.
  const nonZero = data.filter((d) => d.value > 0)
  if (nonZero.length === 1) {
    const onlyIdx = data.indexOf(nonZero[0])
    const { fill } = pieToneFor(onlyIdx)
    return (
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={className}
        role="img"
        aria-label={`${nonZero[0].label}: 100%`}
      >
        <circle
          cx={cx}
          cy={cy}
          r={(r + ri) / 2}
          fill="none"
          className={fill}
          stroke="currentColor"
          strokeWidth={r - ri}
        />
      </svg>
    )
  }

  // General case — emit one donut-sector path per slice. The path is:
  //   M outer-start → A outer arc → L inner-end → A inner arc back → Z
  // Cumulative offsets precomputed to keep the render function pure (React 19
  // strict mode forbids reassigning closure variables during render).
  const offsets = data.reduce<number[]>((acc, d) => {
    const last = acc[acc.length - 1] ?? 0
    acc.push(last + Math.max(0, d.value))
    return acc
  }, [0])
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Distribution"
    >
      {data.map((d, i) => {
        if (d.value <= 0) return null
        const start = offsets[i] / total
        const end = offsets[i + 1] / total
        const a0 = start * 2 * Math.PI - Math.PI / 2
        const a1 = end * 2 * Math.PI - Math.PI / 2
        const large = end - start > 0.5 ? 1 : 0
        const x0o = (cx + r * Math.cos(a0)).toFixed(3)
        const y0o = (cy + r * Math.sin(a0)).toFixed(3)
        const x1o = (cx + r * Math.cos(a1)).toFixed(3)
        const y1o = (cy + r * Math.sin(a1)).toFixed(3)
        const x0i = (cx + ri * Math.cos(a0)).toFixed(3)
        const y0i = (cy + ri * Math.sin(a0)).toFixed(3)
        const x1i = (cx + ri * Math.cos(a1)).toFixed(3)
        const y1i = (cy + ri * Math.sin(a1)).toFixed(3)
        const path = [
          `M ${x0o} ${y0o}`,
          `A ${r} ${r} 0 ${large} 1 ${x1o} ${y1o}`,
          `L ${x1i} ${y1i}`,
          `A ${ri} ${ri} 0 ${large} 0 ${x0i} ${y0i}`,
          `Z`,
        ].join(" ")
        return (
          <path
            key={d.key}
            d={path}
            className={pieToneFor(i).fill}
            stroke="var(--card)"
            strokeWidth={0.6}
          />
        )
      })}
    </svg>
  )
}
