# Viddix Ops — Prompt de Rediseño Visual (para Claude Code)

> Copia y pega el bloque `## PROMPT` completo en Claude Code dentro de este repo. Está calibrado para Next.js 16 + React 19 + Tailwind v4 + shadcn (`style: base-nova`) + `@base-ui/react` + lucide. Referencias visuales aprobadas por el usuario: **retohealth-production.up.railway.app** (peso principal) y **ceo-advisors-crm-production.up.railway.app** (peso secundario).

---

## PROMPT

Vas a hacer un **refactor visual completo** de `viddix-ops` (Next.js 16, React 19, Tailwind v4, shadcn `base-nova`, `@base-ui/react`, lucide, next-themes). El objetivo es que la app **deje de parecer "IA por defecto"** y adopte el lenguaje visual de [retohealth-production.up.railway.app](https://retohealth-production.up.railway.app/) — premium, editorial, sobrio, operations-console, con sidebar oscura + canvas claro.

**No toques lógica de negocio, hooks, queries, ni el schema de Supabase.** Solo capas visuales y de presentación.

### 0. Reglas anti-AI (innegociables)

1. **Prohibido Inter, Roboto, Arial, system-ui, Geist Sans** como tipografía principal. Son los tells nº1 de "esto lo generó una IA". Sustituir.
2. **Prohibido el primary `#4f8ef7`** y cualquier `from-purple-500 to-blue-500` o gradiente índigo→fucsia. Es la paleta cliché de AI demos.
3. **Prohibidos los `shadow-2xl` decorativos sin propósito** y los `bg-gradient-to-br from-slate-50 to-white` por defecto.
4. **Prohibido `text-gray-500`** ad-hoc. Toda la tipografía secundaria va por los tokens semánticos ya existentes (`text-text-secondary`, `text-text-tertiary`).
5. **Prohibido inventar tokens en archivos sueltos.** Todo color/espacio/radio nuevo entra en `src/app/globals.css` dentro del bloque `@theme inline` y `:root` / `.dark`.
6. **Antes de codear** lee `node_modules/next/dist/docs/` para no romper convenciones de Next.js 16 (la versión del repo tiene breaking changes vs. tu training data — está documentado en `AGENTS.md`).

### 1. Dirección estética: "Editorial Operations Console"

| Atributo | Decisión |
|---|---|
| **Personalidad** | Sobrio, editorial, premium institucional. Como Linear ∩ el portal interno de un private bank. Nada de "startup pastel". |
| **Densidad** | Aireada en headers/KPIs, densa en tablas y kanban. Cambio de ritmo intencional. |
| **Atmósfera** | Papel cálido en superficies, grafito casi-negro en sidebar, grain sutil opcional en hero del dashboard. |
| **Voz tipográfica** | Display **serif variable** (con WONK/SOFT axes) para H1/H2/KPIs grandes. Sans-serif característico para body/UI. Mono editorial para datos numéricos en tablas. |
| **Color** | Monocromo cálido + **un único accent vivo**. Cero arcoíris. |
| **Motion** | Restringida y elegante. Stagger de entrada en dashboard, transiciones <180ms en hover. Sin "bounce" exagerado. |

### 2. Tipografía (sustituye `src/app/layout.tsx`)

Usa `next/font/google`:

```ts
import { Fraunces, Inter_Tight, JetBrains_Mono } from "next/font/google"

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
})

const sans = Inter_Tight({                 // alternativa a Inter — más estrecho, con personalidad
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
})

const mono = JetBrains_Mono({
  variable: "--font-mono",                  // renombrar desde --font-geist-mono
  subsets: ["latin"],
  display: "swap",
})
```

> Si más adelante quieres una pareja todavía más distintiva, sustituye `Inter_Tight` por `Söhne` (de pago) o por **Satoshi** / **General Sans** servidos desde Fontshare via `<link>` en `<head>` (en ese caso, documenta el cambio en `docs/`). Por ahora `Inter Tight` es la opción Google-Fonts más segura que NO es Inter clásico.

Actualiza `globals.css`:

```css
@theme inline {
  --font-sans: var(--font-sans);
  --font-display: var(--font-display);
  --font-mono: var(--font-mono);
  --font-heading: var(--font-display);   /* ya está mapeado, redirige a display */
}

@layer base {
  html { @apply font-sans; }
  h1, h2, .display {
    font-family: var(--font-display);
    font-feature-settings: "ss01", "ss02";
    letter-spacing: -0.02em;
  }
  .num, .tabular { font-variant-numeric: tabular-nums; }
}
```

### 3. Paleta — sustituir tokens en `:root` y `.dark`

**Sustituye los actuales** en `src/app/globals.css`. Mantén los nombres de variable; cambia solo los valores.

```css
:root {
  /* — Superficies cálidas (papel) en vez de slate-50 frío — */
  --background: #FAF7F2;                /* paper warm */
  --foreground: #16161A;                /* graphite, no slate-900 */

  --card: #FFFFFF;
  --card-foreground: #16161A;
  --popover: #FFFFFF;
  --popover-foreground: #16161A;

  /* — Accent único: jade profundo (sustituye el azul genérico) — */
  --primary: #0E7C66;                   /* jade-700 */
  --primary-foreground: #FAF7F2;

  --secondary: #EFE9DF;                 /* papel sunken */
  --secondary-foreground: #16161A;

  --muted: #EFE9DF;
  --muted-foreground: #5A5A63;          /* graphite-500, AA sobre paper */

  --accent: #E8F1EE;                    /* jade-50 */
  --accent-foreground: #0B5A4B;

  --destructive: #B23A1F;               /* terracota — más editorial que red-600 */

  --border: #E5DED1;                    /* paper-300 */
  --input: #E5DED1;
  --ring: #0E7C66;

  /* — Chart palette: tonal + un acento, no arcoíris — */
  --chart-1: #0E7C66;                   /* jade */
  --chart-2: #3D2B4E;                   /* plum profundo */
  --chart-3: #C28F2C;                   /* ochre */
  --chart-4: #5A5A63;                   /* graphite */
  --chart-5: #B23A1F;                   /* terracota */

  /* — Texto semántico — */
  --text-primary:   #16161A;
  --text-secondary: #5A5A63;
  --text-tertiary:  #8A8A93;

  /* — Superficies — */
  --surface-1: #FAF7F2;                 /* page */
  --surface-2: #FFFFFF;                 /* raised */
  --surface-3: #EFE9DF;                 /* sunken */

  --border-subtle:  rgba(22, 22, 26, 0.06);
  --border-default: #E5DED1;

  --success: #0E7C66;                   /* mismo jade, refuerza identidad */
  --success-foreground: #FAF7F2;
  --warning: #A56B12;                   /* ochre dark, AA sobre blanco */
  --warning-foreground: #FAF7F2;
  --info: #3D2B4E;                      /* plum */
  --info-foreground: #FAF7F2;

  /* — Sidebar grafito cálido, no slate puro — */
  --sidebar: #1A1A1D;
  --sidebar-foreground: #BFB8AD;
  --sidebar-primary: #0E7C66;
  --sidebar-primary-foreground: #FAF7F2;
  --sidebar-accent: #2A2A2E;
  --sidebar-accent-foreground: #FAF7F2;
  --sidebar-border: #2A2A2E;
  --sidebar-ring: #0E7C66;
}

.dark {
  --background: #0E0E10;
  --foreground: #ECE6D9;
  --card: #16161A;
  --card-foreground: #ECE6D9;
  --popover: #16161A;
  --popover-foreground: #ECE6D9;
  --primary: #2CAE94;                   /* jade lifted para superficies oscuras */
  --primary-foreground: #0E0E10;
  --secondary: #1F1F23;
  --secondary-foreground: #ECE6D9;
  --muted: #1F1F23;
  --muted-foreground: #BFB8AD;
  --accent: #1F1F23;
  --accent-foreground: #ECE6D9;
  --destructive: #E07A5F;
  --border: rgba(236, 230, 217, 0.08);
  --input: rgba(236, 230, 217, 0.12);
  --ring: #2CAE94;

  --text-primary:   #ECE6D9;
  --text-secondary: #BFB8AD;
  --text-tertiary:  #8A8A93;

  --surface-1: #0E0E10;
  --surface-2: #16161A;
  --surface-3: #1F1F23;

  --border-subtle:  rgba(236, 230, 217, 0.06);
  --border-default: rgba(236, 230, 217, 0.12);
}
```

### 4. Escala de espacio y radios — añadir al `@theme inline`

```css
@theme inline {
  /* Radios ya definidos: 6 / 10 / 14 / 18 — mantener */
  /* Añadir escala vertical "editorial" para layout */
  --spacing-page-x: 2rem;       /* 32px gutter en desktop */
  --spacing-section: 4rem;      /* 64px entre secciones del dashboard */
  --spacing-card-y: 1.25rem;    /* ritmo interno de cards */

  /* Sombras de papel — más bajas, más cálidas */
  --shadow-paper-sm: 0 1px 2px rgba(22,22,26,.04), 0 1px 1px rgba(22,22,26,.03);
  --shadow-paper-md: 0 4px 12px rgba(22,22,26,.06), 0 2px 4px rgba(22,22,26,.04);
  --shadow-paper-lg: 0 12px 32px rgba(22,22,26,.08), 0 4px 8px rgba(22,22,26,.04);
}
```

Reemplaza usos de `shadow-sm`/`shadow-md`/`shadow-lg` en cards/popovers por `shadow-[var(--shadow-paper-sm)]` etc. donde el componente exista.

### 5. Componentes — refactor por archivo

Para cada archivo: cambia **solo presentación** (className, estructura visual, tokens). Mantén props, eventos y estado.

#### 5.1 `src/components/dashboard/sidebar.tsx`
- Logo `V`: cambia el cuadrado `bg-primary` por una **marca tipográfica**. Usa la display serif para una `V` mayúscula con `font-feature-settings: "ss01"`, sin caja de color. A su derecha, "Viddix Ops" en sans con `letter-spacing:-0.01em`.
- Sección "Workspace": el caption usa `font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60`. Más "editorial".
- Items de nav: el indicador activo (`before:bg-sidebar-primary`) sustitúyelo por una **barra vertical de 2px en jade** + el fondo `bg-white/[0.04]` (más sutil). Añade `aria-current` ya está.
- Footer `StorageStatus`: añade encima un bloque "presence" con avatar + nombre del usuario actual (`useCurrentProfile`) en bloque pulcro tipo Linear. Si no hay usuario, omite.
- Width: sube a `w-64` solo si el caption "Workspace" cabe sin truncar.

#### 5.2 `src/components/dashboard/topbar.tsx`
- Reemplaza el típico topbar genérico por una franja editorial:
  - Izquierda: **breadcrumb** con la display serif para el nodo final (ej. `Holding · `+`**Dashboard**` en serif italic 16px).
  - Centro: vacío.
  - Derecha: `⌘K` con kbd estilo `font-mono text-[11px] border-border-subtle rounded-sm px-1.5 py-0.5`, notification bell con badge numérico jade, separador vertical `bg-border-subtle h-5 w-px`, avatar de usuario.
- Altura: 56px. Borde inferior 1px `border-border-subtle`, sin sombra.

#### 5.3 `src/components/dashboard/page-header.tsx`
- Layout en **dos líneas editoriales**:
  - Eyebrow: caption mono uppercase tracking-wide (ej. "PIPELINE — Q2 2026") en `text-text-tertiary text-[11px]`.
  - Título: `font-display text-[34px] leading-[1.05] tracking-[-0.02em] text-text-primary` — usa Fraunces con axes `WONK 0 / SOFT 50` para que tenga personalidad pero sin gritar.
  - Subtítulo opcional: sans, `text-text-secondary text-[15px] leading-relaxed max-w-prose`.
- Acciones primarias a la derecha en una fila, con `gap-2`. Botón primario: jade sólido. Secundarios: ghost con borde sutil.
- Añade un `<hr className="mt-6 border-border-subtle" />` debajo para separar del contenido.

#### 5.4 `src/components/ui/button.tsx`
- Mantén `cva`. Ajusta variantes:
  - `default`: `bg-primary text-primary-foreground hover:brightness-110 shadow-[var(--shadow-paper-sm)]` — quita `shadow-xs` genérico.
  - `secondary`: `bg-transparent border border-border-default text-text-primary hover:bg-surface-3` — más "outline editorial" que "fondo gris".
  - `ghost`: `text-text-secondary hover:bg-surface-3 hover:text-text-primary`.
  - `destructive`: usa `--destructive` (terracota), `hover:brightness-105`.
- Sizes: añade `xs` (h-7 px-2 text-[12px]) para tablas densas.
- Tipografía: `font-medium tracking-[-0.005em]`.
- Transición: `transition-[background,color,box-shadow] duration-150 ease-out`.

#### 5.5 `src/components/ui/card.tsx`
- `Card`: fondo `bg-card`, borde `border border-border-subtle`, radius `rounded-[var(--radius-lg)]`, sombra `shadow-[var(--shadow-paper-sm)]`. **Sin** `bg-gradient-*`.
- `CardHeader`: `flex items-baseline justify-between gap-3 px-5 pt-5 pb-3 border-b border-border-subtle`.
- `CardTitle`: `font-display text-[18px] tracking-[-0.01em]` — serif sutil, no sans bold.
- `CardContent`: `px-5 py-4`.
- Añadir variante `tone="raised"` que usa `shadow-paper-md` y sin borde, para hero KPI.

#### 5.6 `src/components/ui/kpi-stat.tsx`
- Layout vertical:
  - Label: mono uppercase tracking-wide, 11px, `text-text-tertiary`.
  - Valor: **display serif**, `font-display text-[44px] leading-none tracking-[-0.03em] tabular-nums text-text-primary`.
  - Delta: pill pequeño con flecha; positivo jade, negativo terracota; ambos con borde 1px y fondo `--accent` translúcido.
  - Sparkline debajo a 100% width, `h-10`, color `--chart-1` con `stroke-width:1.5`, sin fill (solo línea).
- Sin sombra propia: hereda del card padre.

#### 5.7 `src/components/ui/badge.tsx` y `src/components/dashboard/{status,priority,team}-badge.tsx`
- Forma: `rounded-full` para status/priority, `rounded-[var(--radius-sm)]` para team.
- Tipografía: `text-[11px] font-medium tracking-[0.01em] uppercase` solo para status. Priority y team en case normal.
- Color: usa `--success`/`--warning`/`--info`/`--destructive` con fondo translúcido `color-mix(in oklch, var(--success) 14%, transparent)` y texto al token.
- Quita cualquier `bg-emerald-100 text-emerald-700` ad-hoc.

#### 5.8 `src/components/dashboard/command-palette.tsx` (cmdk)
- Override de estilos cmdk:
  - Contenedor: `rounded-[var(--radius-xl)] border border-border-subtle bg-card shadow-[var(--shadow-paper-lg)] backdrop-blur` con max-width 640px.
  - Input: sans, 16px, `tracking-[-0.01em]`, sin borde, con placeholder en `text-text-tertiary`.
  - Items activos: `bg-surface-3 border-l-2 border-primary pl-[14px]` — barra jade idéntica a la sidebar para coherencia.
  - Group label: mono uppercase tracking-wide 10px.

#### 5.9 `src/app/(dashboard)/dashboard/page.tsx`
- Layout: usa una grid editorial:
  - Fila 1: 4 `KPIStat` en `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3`.
  - Fila 2: dos columnas asimétricas `xl:grid-cols-[1.6fr_1fr]` — izquierda `PipelineFunnel`, derecha `RecentActivity`.
  - Fila 3: tasks-de-hoy + próximos eventos en `xl:grid-cols-2`.
- Aplica un **stagger de entrada** con CSS puro: a cada hijo directo del main, `animation: rise .6s var(--delay) cubic-bezier(.2,.6,.2,1) both`, con `--delay` calculado por nth-child o inline `style={{ animationDelay: '${i*60}ms' }}`. Define `@keyframes rise { from { opacity:0; transform: translateY(8px) } }`. Solo en primer mount.
- Reemplaza títulos `<h2>` por `<PageHeader eyebrow="…" title="…" subtitle="…" />`.

#### 5.10 `src/app/(dashboard)/leads/leads-board.tsx`
- Kanban: columnas con header tipo "carpeta editorial":
  - Caption mono + contador en pill pequeño jade outline.
  - Línea horizontal 1px `border-border-subtle` separando header del body de columna.
- Card de lead: bg-card, border-subtle, radius-md, padding 12px. Title `font-medium text-[14px]`, valor en mono `tabular-nums`, owner avatar 20px abajo-derecha.
- Hover: `shadow-paper-md` + `-translate-y-px`, transición 120ms.
- Drag preview (`@hello-pangea/dnd`): `shadow-paper-lg rotate-[1.5deg]`.

#### 5.11 Tablas (clients-table, partners-view, tasks-view, activity-view)
- Header row: `bg-surface-3 text-[11px] font-mono uppercase tracking-[0.12em] text-text-tertiary`. Borde inferior 1px.
- Body rows: `border-b border-border-subtle`, hover `bg-surface-3/50`, **sin** zebra stripes.
- Cifras: `font-mono tabular-nums text-text-primary`.
- Acciones por fila: `Button size="xs" variant="ghost"`.
- Toolbar superior de tabla: input search con icono lucide a la izq, filtros chip outline a la dcha, contador "{n} de {N}" en mono a la izquierda del paginador.

#### 5.12 `src/app/(auth)/login/page.tsx`
- Layout split 60/40:
  - Izquierda: card centrada max-w-sm con logo display serif arriba, copy editorial, form con inputs grandes (h-11), botón jade full-width.
  - Derecha (hidden md:block): canvas decorativo — gradiente vertical de `--surface-3` a `--surface-1`, un grano SVG (data-uri turbulence) al 6% opacity, y una cita en `font-display italic text-[22px] text-text-secondary max-w-md` (placeholder: "Operaciones que piensan en silencio.").
- Background page: `--surface-1`.

### 6. Atmósfera (opcional pero alto impacto)

Añade un **componente `<Grain />`** en `src/components/ui/grain.tsx` que renderiza un `<svg>` fijo `pointer-events-none` con `feTurbulence` baseFrequency `0.9` y `opacity:.035`, posicionado `fixed inset-0 z-[1]`. Inclúyelo solo en `(dashboard)/layout.tsx` envolviendo el main. Da textura sin ruido visible. Probar en light; en dark bajar a `opacity:.025`.

### 7. Motion

- Crea `src/lib/motion.ts` con presets: `easeOutEditorial = "cubic-bezier(0.2, 0.6, 0.2, 1)"`, `dur = { fast: 120, base: 180, slow: 320 }`.
- Hover en interactivos: `transition-[background,color,border-color,box-shadow,transform] duration-150 ease-[cubic-bezier(.2,.6,.2,1)]`.
- Dialog/Sheet/Popover (`@base-ui/react`): override de `data-[state=open]:animate-in` para usar `fade-in slide-in-from-bottom-1` con 180ms.
- Page transitions: NO añadir librería. Solo el stagger CSS del dashboard.

### 8. Accesibilidad — checklist obligatorio antes de cerrar

1. Contraste AA en TODOS los pares texto/fondo. Verifica con un script Node usando `wcag-contrast` (`npx wcag-contrast '#5A5A63' '#FAF7F2'`).
2. Focus ring jade visible en TODOS los interactivos (ya está el `:focus-visible` global — no lo rompas).
3. `prefers-reduced-motion`: envolver el stagger del dashboard en `@media (prefers-reduced-motion: no-preference)`.
4. Sidebar nav: `aria-current="page"` ya existe — mantener.
5. KPI delta: añadir `aria-label` ("+12% vs semana anterior").

### 9. Plan de ejecución (en este orden)

1. **Lee** `node_modules/next/dist/docs/` lo relevante a `app/`, `next/font`, `metadata`.
2. **Tokens y fonts**: `src/app/globals.css` + `src/app/layout.tsx`. Compila y verifica que `npm run dev` arranca sin warnings de tokens.
3. **Primitivos UI** (button, card, badge, input, kpi-stat). Snapshot visual rápido — render manual de cada uno.
4. **Chrome de la app**: sidebar, topbar, page-header, command-palette.
5. **Dashboard home** con stagger.
6. **Leads board** (kanban).
7. **Tablas** (clients, partners, tasks, activity).
8. **Login**.
9. **Grain + motion presets**.
10. **Pase de accesibilidad** + checklist de la sección 8.
11. **Verificación final**: `npm run build` debe pasar sin errores. `npm run lint` limpio.

### 10. Entregable

- Una rama `feat/ui-editorial` con todos los cambios.
- Un `docs/UI_CHANGELOG.md` con: paleta antes/después, tipografías, lista de archivos modificados, screenshots del dashboard, leads board y login (capturas en `/public/redesign-screens/`).
- Resumen de 5 líneas al final del PR explicando la decisión estética en una frase y el rationale anti-AI.

### 11. Qué NO hacer

- No introducir framer-motion ni librerías nuevas salvo justificación documentada.
- No tocar la lógica de Supabase, hooks (`use-*`), `lib/metrics.ts`, ni el schema.
- No añadir emojis ni iconos decorativos fuera de lucide.
- No usar `text-3xl font-bold` para H1 — siempre `font-display text-[32-40px] tracking-tight`.
- No "modernizar" copy en español/inglés — esto es solo UI.
- No commitear screenshots dentro de `node_modules` o `.next`.

---

Cuando termines: pega el diff resumen, la lista de archivos tocados, y los hex finales si hubiera ajustes desde esta paleta base. Si te encuentras con que algún token del shadcn `base-nova` colisiona, documenta y pregúntame antes de improvisar.
