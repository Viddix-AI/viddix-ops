"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginInner />
    </React.Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get("next") ?? "/dashboard"

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      // No Supabase env? Skip auth, jump straight in — useful for local demos.
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        router.push(next)
        return
      }
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push(next)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2">
            <span
              className="grid size-8 place-items-center rounded-lg text-primary-foreground"
              style={{ background: "#4F8EF7" }}
            >
              <span className="font-heading text-base font-semibold">V</span>
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">
              Viddix Ops
            </span>
          </Link>

          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your Viddix workspace.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground/80">Email</span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pablo@viddix.ai"
                className="h-10"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground/80">Password</span>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10"
                required
              />
            </label>

            <Button
              type="submit"
              className="h-10 w-full"
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground">
            Internal access only. Reach out to Pablo Martin for a workspace
            invite.
          </p>
        </div>
      </div>

      <div
        className="relative hidden lg:block"
        style={{
          background:
            "radial-gradient(1200px 600px at 80% 10%, rgba(79,142,247,.25), transparent 60%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        }}
      >
        <div className="absolute inset-0 flex flex-col justify-end p-12 text-slate-200">
          <div className="max-w-md">
            <p className="font-heading text-3xl font-semibold leading-tight tracking-tight text-white">
              Run the agency, don&apos;t let it run you.
            </p>
            <p className="mt-3 text-sm text-slate-300">
              Pipeline, clients, tasks and the calendar — all in one place,
              built for the three of us.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
