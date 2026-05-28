"use client"

import * as React from "react"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pill } from "@/components/ui/pill"
import { money } from "@/lib/format"
import { pipelineFunnel } from "@/lib/metrics"
import { LEAD_STAGES, type Lead } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Horizontal pipeline funnel.
 *
 * Replaces the previous "7 vertical bars" dashboard pipeline with a
 * cumulative funnel that reads left → right (top of pipeline → won).
 * Between each stage we show a small conversion % so the reader can spot
 * the leakage stage at a glance.
 *
 * Lost leads are intentionally not in the funnel — they're a side exit,
 * not a stage. We surface the lost count below the funnel for context.
 */
export function PipelineFunnel({ leads }: { leads: Lead[] }) {
  const rows = pipelineFunnel(leads)
  const top = rows[0]?.count ?? 0
  const lostCount = leads.filter((l) => l.stage === "lost").length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        {top === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <p>No leads in the pipeline yet.</p>
            <Link
              href="/leads"
              className="text-xs font-medium text-primary hover:underline"
            >
              Add your first lead →
            </Link>
          </div>
        ) : (
          <>
            <FunnelShape rows={rows} top={top} />

            {/*
              Data row underneath the funnel. The visual taper above is the
              headline; this row carries the per-stage numbers + the conversion
              ratio between consecutive stages.
            */}
            <div className="mt-3 flex items-stretch gap-1">
              {rows.map((row, i) => {
                const stage = LEAD_STAGES.find((s) => s.id === row.stage)
                return (
                  <React.Fragment key={row.stage}>
                    {i > 0 && (
                      <ConversionIndicator value={row.conversion ?? null} />
                    )}
                    <div
                      className={cn(
                        "flex min-w-0 flex-1 flex-col items-start gap-1.5",
                        row.count === 0 && "opacity-60"
                      )}
                    >
                      <Pill tone={stage?.pillTone ?? "slate"} size="sm" uppercase>
                        {stage?.label ?? row.stage}
                      </Pill>
                      <p className="font-display text-[20px] leading-none tracking-[-0.02em] tabular-nums text-text-primary">
                        {row.count}
                      </p>
                      {row.value > 0 && (
                        <p className="font-mono text-[10px] tabular-nums text-text-tertiary">
                          {money(row.value)}
                        </p>
                      )}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3 text-xs text-text-secondary">
              <span>
                {leads.length} total leads
                {lostCount > 0 && (
                  <>
                    {" "}
                    <span className="text-text-tertiary">·</span>{" "}
                    <span className="text-text-secondary">{lostCount} lost</span>
                  </>
                )}
              </span>
              <Link
                href="/leads"
                className="font-medium text-primary hover:underline"
              >
                Open pipeline →
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Tapered SVG funnel — one trapezoidal slice per stage. The left edge of
 * each slice matches the previous slice's right edge so the shape reads as
 * a single continuous funnel narrowing from `new` toward `won`. The trailing
 * edge of the final slice steps inward to ~30% of its own height to give
 * the unmistakable "funnel tip" silhouette.
 *
 * Slice height is proportional to `count / topCount`, floored at MIN_H so
 * empty late stages still render a sliver instead of disappearing.
 */
function FunnelShape({
  rows,
  top,
}: {
  rows: ReturnType<typeof pipelineFunnel>
  top: number
}) {
  const W = 1000
  const H = 140
  const MIN_H = 14

  const slabs = rows.map((r) => {
    if (top === 0) return MIN_H
    const ratio = r.count / top
    return Math.max(MIN_H, ratio * H)
  })

  // Synthetic trailing edge so the last slice tapers inward visibly.
  const edges = [...slabs, Math.max(MIN_H * 0.5, (slabs[slabs.length - 1] ?? MIN_H) * 0.3)]
  const N = rows.length
  const sliceW = N > 0 ? W / N : 0

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block h-32 w-full"
      role="img"
      aria-label="Sales pipeline funnel"
    >
      {rows.map((r, i) => {
        const x0 = i * sliceW
        const x1 = x0 + sliceW
        const hL = edges[i]
        const hR = edges[i + 1]
        const yTopL = (H - hL) / 2
        const yBotL = (H + hL) / 2
        const yTopR = (H - hR) / 2
        const yBotR = (H + hR) / 2
        return (
          <polygon
            key={r.stage}
            points={`${x0},${yTopL} ${x1},${yTopR} ${x1},${yBotR} ${x0},${yBotL}`}
            className={cn(
              "fill-primary/15 stroke-border-subtle",
              r.count === 0 && "fill-primary/5"
            )}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </svg>
  )
}

/**
 * Tiny chevron + conversion % between two funnel stages. The chevron
 * stays visible even when conversion is null (e.g. first stage has zero
 * count and we can't compute) so the layout doesn't jitter as data
 * changes.
 */
function ConversionIndicator({ value }: { value: number | null }) {
  return (
    <div className="flex w-10 shrink-0 flex-col items-center justify-center pt-5">
      <span
        aria-hidden
        className="text-base leading-none text-text-tertiary"
      >
        ›
      </span>
      <span
        className={cn(
          "mt-0.5 font-mono text-[10px] tabular-nums",
          value === null
            ? "text-text-tertiary"
            : value >= 50
            ? "text-success"
            : value >= 25
            ? "text-text-secondary"
            : "text-warning"
        )}
        title={value === null ? "No prior stage" : `${value.toFixed(0)}% conversion`}
      >
        {value === null ? "—" : `${value.toFixed(0)}%`}
      </span>
    </div>
  )
}
