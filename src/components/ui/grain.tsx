/**
 * Grain — fixed full-viewport SVG turbulence laid over the page.
 *
 * Adds subtle paper texture without ever shifting layout. baseFrequency 0.9
 * with feTurbulence + low opacity reads as grain rather than visual noise.
 * pointer-events-none so it never intercepts clicks or drags.
 */
export function Grain() {
  return (
    <span
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035] dark:opacity-[0.025] mix-blend-multiply"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>\")",
        backgroundSize: "180px 180px",
      }}
    />
  )
}
