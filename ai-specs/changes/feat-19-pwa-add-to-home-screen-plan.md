# Frontend Implementation Plan: feat-19 PWA + Add to Home Screen

## 1. Analysis & Design

* **Goal**: Turn Ze Finance into a Progressive Web App (PWA) with `display: "standalone"` so users gain full-screen experience without browser chrome. Prompt mobile users to "Add to Home Screen" to improve UX and reclaim space lost to address bar and browser buttons.
* **Route**: No new route; changes span `app/layout.tsx`, `public/`, and a new global client component. The prompt surfaces on authenticated pages (inside `AppShell`) or as a root-level banner.
* **Responsive Layout**:
  * **Mobile**: Show Add-to-Home-Screen prompt (banner or bottom sheet). On iOS: instructional copy (Share > Add to Home Screen). On Android/Chrome: custom install button when `beforeinstallprompt` fires. Hide prompt when already in standalone/fullscreen mode.
  * **Tablet**: Same prompt logic; banner/sheet adapts to width.
  * **Desktop**: Hide prompt entirely (PWA install is primarily a mobile concern; optional: allow install but no aggressive prompt).
* **Server vs Client**: `layout.tsx` remains Server Component; manifest and viewport are static. A new client component `PwaInstallPrompt` (or `AddToHomeScreenBanner`) requires `'use client'` for `beforeinstallprompt`, `matchMedia`, `localStorage`, and user interactions.

---

## 2. Component Architecture

* **New Components**:
  * `AddToHomeScreenBanner.tsx` (or `PwaInstallPrompt.tsx`): Client component that:
    * Renders a dismissible banner/sheet on mobile when (a) not in standalone mode, (b) user has not dismissed it recently (e.g. localStorage key `zefa_pwa_prompt_dismissed`), (c) optionally not yet installed (Chrome sets `beforeinstallprompt` only when installable).
    * On Android/Chrome: listens for `beforeinstallprompt`, stores the event, shows "Instalar" button; on click calls `prompt()`.
    * On iOS Safari: shows instructions (e.g. "Toque em Compartilhar e depois em Adicionar à Tela Inicial") with a small Share icon illustration or text.
    * Props: `onDismiss?: () => void` (optional callback); internal state for visibility, deferred prompt, and OS/browser detection.
  * `usePwaInstall.ts` (hook): Encapsulates `beforeinstallprompt`, `isStandalone`, `isIOS`, `canPrompt`, and `promptInstall()`. Used by `AddToHomeScreenBanner`.
* **ShadcnUI Primitives**: Reuse `Button`, `Card`. Consider adding `Sheet` via `npx shadcn@latest add sheet` if a slide-up panel is preferred over a fixed banner; otherwise a simple `div` with `fixed bottom-0` + `safe-area-bottom` is sufficient.
* **Icons**: `Share2`, `Download`, `Smartphone`, `X` (Lucide React) for the banner. No new asset icons required for the prompt UI; PWA manifest icons are separate (see below).

---

## 3. State & Data Fetching

* **API Interactions**: None. PWA logic is purely client-side.
* **Local State** (in `AddToHomeScreenBanner` / `usePwaInstall`):
  * `deferredPrompt: BeforeInstallPromptEvent | null` – stored when `beforeinstallprompt` fires (Chrome/Edge).
  * `isStandalone: boolean` – `window.matchMedia('(display-mode: standalone)').matches` or `(window as any).standalone` (iOS) or `navigator.standalone`.
  * `isIOS: boolean` – UA or feature detection (e.g. `/iPad|iPhone|iPod/.test(navigator.userAgent)` or `'ontouchend' in document` + Safari).
  * `showBanner: boolean` – true when conditions pass and user has not dismissed.
  * `isInstallable: boolean` – true when `deferredPrompt` exists (Chrome) or we show iOS instructions.
* **Persistence**: `localStorage.getItem/setItem('zefa_pwa_prompt_dismissed')` with optional timestamp (e.g. do not show again for 7 days) or simple boolean.
* **Global Context**: Does not need `useAuth()`; the banner can appear for both authenticated and unauthenticated users. If desired, only show when authenticated (e.g. inside `AppShell`) to avoid noise on login/register.

---

## 4. Implementation Steps

1. **Create Web App Manifest**
   * Add `public/manifest.json` (or `public/manifest.webmanifest`) with:
     * `name`, `short_name` (e.g. "Ze Finance", "Zefa")
     * `display: "standalone"`
     * `start_url: "/"`
     * `theme_color`, `background_color` (align with existing `layout` themeColor: `#0d9488`, `#14b8a6` for dark)
     * `orientation: "portrait"`
     * `icons`: array of `{ src, sizes, type, purpose }` – at least 192x192, 512x512 for PWA; optionally 48, 96, 144, 256.
   * Ensure manifest is linked in `app/layout.tsx` via `<link rel="manifest" href="/manifest.json" />` (Next.js Metadata API supports `manifest`).

2. **Provide PWA Icons**
   * Layout already references `/icon-light-32x32.png`, `/icon-dark-32x32.png`, `/apple-icon.png`, `/icon.svg`. Add or generate:
     * 192x192 and 512x512 PNG for manifest.
     * 180x180 for `apple-touch-icon` if not present.
   * Place in `public/` and reference in manifest.

3. **Update Viewport for Standalone**
   * In `app/layout.tsx` `viewport` export, add `viewportFit: "cover"` so safe-area insets work in standalone mode.

4. **Define Safe-Area Utility Classes**
   * In `globals.css`, add:
     * `.safe-area-top { padding-top: env(safe-area-inset-top, 0px); }`
     * `.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }`
   * Ensure `html` has `viewport-fit=cover` (handled by viewport config) so `env()` is defined.

5. **Implement `usePwaInstall` Hook**
   * File: `lib/hooks/usePwaInstall.ts`
   * Effects: listen for `beforeinstallprompt`, prevent default, store event; detect `isStandalone` and `isIOS`.
   * Return: `{ canPrompt, isStandalone, isIOS, deferredPrompt, promptInstall }`.
   * Only run in `typeof window !== 'undefined'`.

6. **Implement `AddToHomeScreenBanner` Component**
   * File: `components/pwa/AddToHomeScreenBanner.tsx`
   * Use `usePwaInstall`; check `localStorage` for dismissed state.
   * Render only when `!isStandalone` and `showBanner` and (mobile viewport or `isIOS`/Android).
   * UI: Fixed bottom banner (or Sheet) with:
     * Android: "Instalar app" button that calls `promptInstall()`.
     * iOS: "Adicione à tela inicial" + short instruction (Compartilhar > Adicionar à Tela Inicial).
     * Dismiss (X) button; on dismiss, set `localStorage` and hide.
   * Apply `safe-area-bottom` to avoid overlap with device home indicator.
   * Text in Portuguese (pt-BR) per project rules for user-facing copy.

7. **Integrate Banner in Layout**
   * Add `<AddToHomeScreenBanner />` inside `ThemeProvider`/`AuthProvider` in `layout.tsx`, or inside `AppShell` if showing only when authenticated. Ensure it is a client child (works since layout can render client components as children).

8. **Optional: Apply `min-height: 100dvh`**
   * In `AppShell` or `globals.css`, use `min-height: 100dvh` for main content areas to handle dynamic viewport on mobile (address bar hide/show).

9. **Verify PWA Criteria**
   * Run Lighthouse PWA audit.
   * Test on real device: Add to Home Screen, open from home screen, confirm standalone mode and no browser UI.

10. **Documentation**
    * Update `PROJECT_DOCUMENTATION.md` / `TECHNICAL_DOCUMENTATION.md` with PWA section (manifest, install flow, icons).

---

## 5. Validation Checklist

- [ ] Uses `api` instance from `@/lib/api` only if calling backend (not needed for this feature).
- [ ] Layout is responsive; banner is mobile-only and does not constrain desktop.
- [ ] Error handling: guard `prompt()` and `deferredPrompt` for null/undefined.
- [ ] No `any` types; use proper typings for `BeforeInstallPromptEvent` (extend `Window` interface or use `unknown` with type guard).
- [ ] `'use client'` on `AddToHomeScreenBanner` and `usePwaInstall` usage.
- [ ] User-facing copy in Portuguese (pt-BR).
- [ ] Safe-area padding applied to banner and bottom nav in standalone mode.
- [ ] PWA manifest linked and valid; icons present.
- [ ] Dismiss state persisted; banner does not reappear aggressively after dismissal.

---

## 6. Technical Notes

* **`BeforeInstallPromptEvent`**: Not in standard TS lib; add to `global.d.ts` or use:
  ```ts
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }
  ```
* **iOS detection**: `navigator.standalone` is deprecated but still used by iOS; `matchMedia('(display-mode: standalone)')` works in PWA context. For in-browser detection, UA or `'ontouchend' in document` can help.
* **Chrome installability**: Requires HTTPS, valid manifest, and service worker (optional for MVP; some browsers allow install without SW). If install fails criteria, `beforeinstallprompt` won't fire—fallback to iOS-style instructions for "Add to Home Screen" is still useful.
* **Service Worker**: Optional for feat-19; can be added later for offline support. Many PWAs work with `display: standalone` without a SW.

---

## 7. File Summary

| Action   | Path |
|----------|------|
| Create   | `public/manifest.json` |
| Create   | `public/icon-192.png`, `public/icon-512.png` (or equivalent) |
| Create   | `lib/hooks/usePwaInstall.ts` |
| Create   | `components/pwa/AddToHomeScreenBanner.tsx` |
| Modify   | `app/layout.tsx` (manifest link, viewport, render banner) |
| Modify   | `app/globals.css` (safe-area classes) |
| Modify   | `components/layout/BottomNavigation.tsx` (add safe-area-bottom if not present) |
| Optional | Add Shadcn `Sheet` for alternative prompt UI |
