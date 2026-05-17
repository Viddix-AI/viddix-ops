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

  const [mode, setMode] = React.useState<"signin" | "signup">("signin")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [fullName, setFullName] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      // No Supabase env? Skip auth, jump straight in — useful for local demos.
      if (!supabaseConfigured) {
        router.push(next)
        return
      }
      const supabase = createClient()
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        // Sign up. handle_new_user trigger in 001_init.sql will create a
        // matching public.profiles row for us.
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            data: { full_name: fullName.trim() || email.split("@")[0] },
          },
        })
        if (error) throw error
        toast.success("Account created. Check your inbox to confirm your email.")
      }
      router.push(next)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-svh grid-cols-1 bg-surface-1 lg:grid-cols-[3fr_2fr]">
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-12 inline-flex items-baseline gap-2.5">
            <span
              className="font-display text-[40px] leading-none text-text-primary"
              style={{ fontFeatureSettings: '"ss01"', letterSpacing: "-0.04em" }}
              aria-hidden
            >
              V
            </span>
            <span className="font-sans text-[15px] font-medium tracking-[-0.01em] text-text-primary">
              Viddix Ops
            </span>
          </Link>

          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            {mode === "signin" ? "ACCESS" : "ENROLMENT"}
          </p>
          <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.02em] text-text-primary">
            {mode === "signin" ? "Welcome back" : "Create your workspace"}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
            {mode === "signin"
              ? "Sign in to your Viddix workspace."
              : "Set up an account for the Viddix CRM."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-text-secondary">Full name</span>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Pablo Martin"
                  className="h-11"
                  required
                />
              </label>
            )}
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-text-secondary">Email</span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pablo@viddix.ai"
                className="h-11"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-text-secondary">Password</span>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11"
                required
                minLength={mode === "signup" ? 8 : undefined}
              />
            </label>

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy
                ? mode === "signin" ? "Signing in…" : "Creating account…"
                : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            className="mt-4 text-xs text-text-tertiary underline-offset-4 hover:text-text-primary hover:underline"
          >
            {mode === "signin"
              ? "Need an account? Create one →"
              : "Already have an account? Sign in →"}
          </button>

          <p className="mt-8 text-xs text-text-tertiary">
            {supabaseConfigured
              ? "Internal workspace. Email confirmation may be required after signup."
              : "Demo mode — no auth backend configured. Any submit signs you in."}
          </p>
        </div>
      </div>

      <div
        className="relative hidden overflow-hidden border-l border-border-subtle lg:block"
        style={{
          backgroundImage:
            "linear-gradient(180deg, var(--surface-3) 0%, var(--surface-1) 100%)",
        }}
      >
        {/* SVG grain over the gradient — pure data-uri turbulence, no asset
            request. Opacity stays low so it reads as paper, not noise. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='1'/></svg>\")",
            backgroundSize: "180px 180px",
          }}
        />
        <div className="absolute inset-0 flex flex-col justify-end p-14">
          <p
            className="max-w-md font-display text-[26px] leading-[1.25] italic tracking-[-0.01em] text-text-secondary"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            “Operations that think in silence.”
          </p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            VIDDIX HOLDING
          </p>
        </div>
      </div>
    </main>
  )
}
