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
    <main className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <span className="font-heading text-base font-semibold">V</span>
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">
              Viddix Ops
            </span>
          </Link>

          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your workspace"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to your Viddix workspace."
              : "Set up an account for the Viddix CRM."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-foreground/80">Full name</span>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Pablo Martin"
                  className="h-10"
                  required
                />
              </label>
            )}
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
                minLength={mode === "signup" ? 8 : undefined}
              />
            </label>

            <Button
              type="submit"
              className="h-10 w-full"
              disabled={busy}
            >
              {busy
                ? mode === "signin" ? "Signing in…" : "Creating account…"
                : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            className="mt-4 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {mode === "signin"
              ? "Need an account? Create one →"
              : "Already have an account? Sign in →"}
          </button>

          <p className="mt-6 text-xs text-muted-foreground">
            {supabaseConfigured
              ? "Internal workspace. Email confirmation may be required after signup."
              : "Demo mode — no auth backend configured. Any submit signs you in."}
          </p>
        </div>
      </div>

      <div
        className="relative hidden bg-sidebar lg:block"
        style={{
          backgroundImage:
            "radial-gradient(1200px 600px at 80% 10%, color-mix(in oklab, var(--primary) 25%, transparent), transparent 60%), linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-accent) 100%)",
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
