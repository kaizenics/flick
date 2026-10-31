# Flick app-screen style (true-black flat)

Reference implementation: `components/dashboard/RepostingPanel.tsx` (read its JSX from `return (` down) and
`components/dashboard/RepostPipeline.tsx`. Match them.

## Already done — do NOT edit
`app/globals.css`, `app/layout.tsx`, `app/(app)/layout.tsx`, everything in `components/ui/`,
`components/dashboard/app-topbar.tsx`, `app-sidebar.tsx`, `RepostingPanel.tsx`, `RepostPipeline.tsx`.

## Tokens (Tailwind classes)
- Ground `bg-background` (#000). Panel `bg-card` (#111). Nested panel `bg-raised` (#2a2a2a). Inputs sit on `bg-black`.
- Elevation by lightness only. Panels: `rounded-[20px] bg-card p-5`. NO `ring-*`, NO `shadow-*`, NO border on panels
  (rings count as shadows in the inspector). Row rules inside a panel: `border-t border-border`.
- Text: `text-white`/default; secondary `text-muted-foreground` (#b4b4b4); meta `text-faint` (#949494). Nothing under 11px
  (`text-[10px]` banned).
- The one data hue: `text-data` / `bg-data` (lime #c6f24e). ONLY on data marks, success/"done" state, a selected radio dot.
  Never on buttons, tabs, nav. Warning `text-warning`; error `text-danger-ink`.
- Status pills: `<Badge variant="positive|warning|negative|neutral">`. No raw `text-green-500`, `text-amber-500`, `text-red-500`,
  `text-indigo-*`, `text-cyan-*`, violet, gradients, glows, emoji.
- Buttons are pills already. One filled primary (`<Button>`, white) per screen, in the title row. Others `variant="outline"`
  or `"ghost"`. Icons in buttons: `<Icon data-icon="inline-start" />`.
- Numbers: add `num` class (tabular figures), right-align numeric table columns. Missing value = "—", zero prints "0".
- Mono (`font-mono`) only for IDs, logs, code.
- Sentence case everywhere. No tiny uppercase tracked labels. No eyebrow labels above headings.
- Gap between panels `gap-3.5` (14px). Page padding: `px-4 pt-7 pb-16 md:px-7`.

## Screen skeleton
```tsx
<>
  <AppTopbar title="Scraping" icon={Search}>{/* optional right-end switcher/actions */}</AppTopbar>
  <div className="flex flex-1 flex-col gap-6 px-4 pt-7 pb-16 md:px-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-xl font-semibold">Noun title</h1>
        <p className="text-sm text-muted-foreground">One sentence: the finding / current state, not UI instructions.</p>
      </div>
      {/* one primary <Button> */}
    </div>
    {/* optional <Tabs> with <TabsList variant="line"> on a full-width border-b, see RepostingPanel */}
    {/* panels */}
  </div>
</>
```
`AppTopbar` is `@/components/dashboard/app-topbar` (renders the 64px bar + mobile SidebarTrigger; do not render your own
`SidebarTrigger` header). The layout's `SidebarInset` is already the `<main>`; use `<div>` not `<main>`.

## Components available
`@/components/ui/`: button, input, textarea, label, switch, badge, tabs, dropdown-menu, dialog, alert-dialog, card, sheet,
tooltip, separator, skeleton, sidebar, breadcrumb. Use `cn` from `@/lib/utils`. Base UI (not Radix): custom triggers use
`render={<Button .../>}`, not `asChild`. Anchor as button: `<Button render={<a href=... />} nativeButton={false}>`.

## Rules for the rebuild
- Keep ALL behaviour: state, fetches, handlers, API calls, localStorage keys, polling. Only restructure JSX/classes and
  improve UX (order blocks by the screen's one question; main job one click from first screen; empty/loading/error states
  inside their panel).
- Settings-like blocks: two-column rows (label + description left, panel right) like `SettingsRow` in RepostingPanel.
- Tables: 12px `text-faint` sentence-case headers, no header band, no zebra, `border-t border-border` row rules,
  wrapped in `overflow-x-auto`.
- Must work at 390px: wrap/stack, no sideways page scroll (`min-w-0` on flex/grid children that hold long text).
- Run `npx tsc --noEmit -p .` until clean.
- Check visually: `export CHROME_PATH=<path to chromium>;
  node <taste-skill>/scripts/inspect.mjs --app
  http://localhost:3010/<route> --out .taste-skill/after/<route>` (dev server already on :3010). Fix every FAIL; read the
  desktop-fold.jpg and mobile-fold.jpg screenshots it lists.
