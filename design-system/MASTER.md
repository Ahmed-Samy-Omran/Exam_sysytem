# Design System — Exam Platform (Master)

Generated with **UI UX Pro Max** (product: *LMS / Learning Management System*) and adapted for Arabic RTL + professional exam UI.

## Style: Flat Design
2D, minimalist, bold colors, **no shadows**, clean lines, simple shapes, typography-focused, icon-heavy. Fast loading, clean transitions (150–200ms ease).

- Light mode only (default). No gradients/shadows anywhere.
- Hover = color/opacity shift (not scale/shadow).
- Icons: **Lucide** (stroke SVG), never emoji-as-icon.
- Category colors drive visual identity alongside a calm base.

## Colors (Tailwind v4 theme tokens)

| Role | Hex | Token |
|---|---|---|
| Primary (teal) | `#0D9488` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#2DD4BF` | `--color-secondary` |
| Background | `#F0FDFA` | `--color-background` |
| Foreground | `#134E4A` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#134E4A` | `--color-card-foreground` |
| Muted | `#E8F1F4` | `--color-muted` |
| Muted Foreground | `#475569` | `--color-muted-foreground` |
| Border | `#5EEAD4` | `--color-border` |
| Accent (amber) | `#D97706` | `--color-accent` |
| Destructive / Wrong | `#DC2626` | `--color-destructive` |
| Success / Correct | `#16A34A` | `--color-success` |
| Ring / Focus | `#0D9488` | `--color-ring` |

### Category accent colors
| Category | Hex | Token |
|---|---|---|
| Accounting | `#16A34A` (green) | `--color-accounting` |
| IQ | `#7C3AED` (purple) | `--color-iq` |
| Excel | `#EA580C` (orange) | `--color-excel` |

Color is never the only signal (badges include text/label per accessibility).

## Typography
- **Headings:** Cairo (weights 600/700/800)
- **Body:** Tajawal (weights 400/500/700)
- Arabic-first, Latin/digits (Excel formulas, numbers) inherit these fonts fine.
- Google Fonts: `https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@400;500;700&display=swap`

## Direction
- `dir="rtl"` + `lang="ar"` globally (`index.html`).
- Code/formulas rendered LTR inline where needed (`dir="ltr"` spans).
- Tailwind logical properties: use `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`, never `ml-`/`mr-`/`left-`/`right-` for layout.

## Key Effects & Motion
- Transitions 150–200ms ease.
- Button press: light opacity shift.
- Respect `prefers-reduced-motion` (@media in CSS).
- No decorative auto-animations.

## Components
- Buttons: `.btn`, `.btn-primary`, `.btn-outline`, `.btn-ghost`, `.btn-danger` — `cursor-pointer`, visible `focus-visible:ring-2 ring-ring`.
- Cards: `.card` (white, 1px border `--color-border`, radius 16px, no shadow).
- Badges: `.badge` + `.badge-{category}`.
- Inputs: border, `focus-visible:ring-2`, labels always visible.
- Progress bar: primary fill on muted track.

## Anti-patterns (from tool + reasoning)
- No hidden assignments / unclear statuses (show question count & progress clearly).
- No cluttered navigation (admin sidebar grouped).
- Avoid dark mode in v1; no neon gradients; no AI purple/pink gradients.

## Accessibility (Pre-Delivery Checklist)
- [ ] No emojis as icons (Lucide SVG only)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover transitions 150–300ms
- [ ] Text contrast ≥ 4.5:1 (light mode)
- [ ] Visible keyboard focus (`focus-visible:ring-2`)
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px / 768px / 1024px / 1440px
- [ ] Text reflows without clipping; labels never truncated silently