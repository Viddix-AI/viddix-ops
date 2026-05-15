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
            <div className="flex items-stretch gap-1">
              {rows.map((row, i) => {
                const stage = LEAD_STAGES.find((s) => s.id === row.stage)
                const pct = top === 0 ? 0 : (row.count / top) * 100
                // Bar width scales with the cumulative count so the funnel
                // narrows visibly as stages progress. Floor at 18% so
                // empty late stages still show a sliver to be discoverable.
                const widthPct = Math.max(18, pct)
                return (
                  <React.Fragment key={row.stage}>
                    {i > 0 && (
                      <ConversionIndicator value={row.conversion ?? null} />
                    )}
                    <div
                      className="flex min-w-0 flex-1 flex-col gap-1.5"
                      style={{ flexBasis: `${widthPct}%` }}
                    >
                      <Pill tone={stage?.pillTone ?? "slate"} size="sm" uppercase>
                        {stage?.label ?? row.stage}
                      </Pill>
                      <div
                        className={cn(
                          "relative h-16 overflow-hidden rounded-md border border-border bg-card",
                          row.count === 0 && "opacity-60"
                        )}
                      >
                        <div
                          aria-hidden
                          className="absolute inset-x-0 bottom-0 bg-primary/15 transition-all"
                          style={{
                            height: `${Math.max(6, pct)}%`,
                          }}
                        />
                        <div className="relative flex h-full flex-col justify-end p-2">
                          <p className="font-heading text-base font-semibold tabular-nums leading-none">
                            {row.count}
                          </p>
                          {row.value > 0 && (
                            <p className="mt-1 text-[10px] font-medium tabular-nums text-muted-foreground">
                              {money(row.value)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
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
