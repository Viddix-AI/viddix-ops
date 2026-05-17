// Motion presets — restrained, editorial. No framer-motion: every motion in the
// app is CSS-based. These constants are referenced inline in Tailwind arbitrary
// values (`duration-[180ms]`) or composed into `transition` declarations when
// elements need multi-property easing.
//
// Why these specific numbers:
//   fast (120ms): hover transitions on tight UI (chips, kbd, table cells).
//   base (180ms): default for dialogs, popovers, page-level transitions.
//   slow (320ms): page-load stagger, larger surface reveals.
//
// The cubic-bezier is the "editorial out" curve — fast start, soft landing.
// Same curve used by Linear's interface motion and Material You's "emphasized
// decelerate". Avoid spring bounces; we want quiet, premium, never giddy.
export const easeOutEditorial = "cubic-bezier(0.2, 0.6, 0.2, 1)"
export const dur = {
  fast: 120,
  base: 180,
  slow: 320,
} as const
