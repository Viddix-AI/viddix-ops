import type { Metadata } from "next"
import { Fraunces, Inter_Tight, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { Providers } from "./providers"

// Editorial pairing: Fraunces for display (variable axes give it character without
// shouting), Inter Tight for UI body (narrower than Inter classic, more voice),
// JetBrains Mono for tabular numerics and captions.
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
})

const sans = Inter_Tight({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
})

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Viddix Ops",
  description: "Internal operations dashboard for Viddix AI.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
