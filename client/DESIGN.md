# Pelican — Design Brief

## Colour Tokens

Two themes: **light** (default fallback) and **dark**. Auto-detected via
`prefers-color-scheme`, overridable with a toggle stored in `localStorage`
key `pelican_theme`. Applied via `data-theme="light|dark"` on `<html>`,
set by a blocking inline script in `index.html` before first paint.

Each theme sets `color-scheme: light` or `color-scheme: dark` so native
form controls, scrollbars, and date inputs match the active theme.

Two `<meta name="theme-color">` tags (one per scheme) are declared in
`index.html`. The active tag's `content` is kept in sync with the theme.

### Light Theme Tokens

| Token                    | Value     | Role                                         |
|--------------------------|-----------|----------------------------------------------|
| `--color-bg-page`        | `#FAFAF9` | Page background (stone-50)                   |
| `--color-bg-surface`     | `#FFFFFF` | Cards, panels, modals, inputs                |
| `--color-bg-inset`       | `#F5F5F4` | Table headers, recessed areas                |
| `--color-border`         | `#E7E5E4` | Hairline dividers and separators (stone-200) |
| `--color-border-emphasis`| `#D6D3D1` | Stronger dividers (stone-300)                |
| `--color-border-input`   | `#8A847E` | Interactive control borders (>= 3:1 vs surface)|
| `--color-text-1`         | `#1C1917` | Primary text (stone-900)                     |
| `--color-text-2`         | `#57534E` | Secondary text (stone-600)                   |
| `--color-text-3`         | `#68625D` | Tertiary — placeholders, timestamps, labels  |
| `--color-accent`         | `#C2410C` | Accent brand / primary action (orange-700)   |
| `--color-accent-hover`   | `#9A3412` | Accent hover state (orange-800)              |
| `--color-accent-subtle`  | `rgba(194,65,12,0.08)` | Subtle accent tint background     |
| `--color-accent-text`    | `#FFFFFF` | Text on accent button                        |
| `--color-ok`             | `#166534` | Success text (green-800)                     |
| `--color-ok-bg`          | `#DCFCE7` | Success badge background (green-100)         |
| `--color-warn`           | `#854D0E` | Warning text (yellow-800)                    |
| `--color-warn-bg`        | `#FEF9C3` | Warning badge background (yellow-100)        |
| `--color-bad`            | `#B91C1C` | Danger / error text (red-700)                |
| `--color-bad-bg`         | `#FEE2E2` | Danger badge background (red-100)            |
| `--color-bad-button`     | `#B91C1C` | Destructive action button fill               |
| `--color-bad-button-hover` | `#991B1B` | Destructive button hover (red-800)         |
| `--color-bad-text`       | `#FFFFFF` | Text on destructive button                   |

### Dark Theme Tokens

| Token                    | Value     | Role                                         |
|--------------------------|-----------|----------------------------------------------|
| `--color-bg-page`        | `#1C1917` | Page background (stone-900)                  |
| `--color-bg-surface`     | `#292524` | Cards, panels, modals, inputs (stone-800)    |
| `--color-bg-inset`       | `#44403C` | Table headers, recessed areas (stone-700)    |
| `--color-border`         | `#44403C` | Hairline dividers and separators (stone-700) |
| `--color-border-emphasis`| `#57534E` | Stronger dividers (stone-600)                |
| `--color-border-input`   | `#78716C` | Interactive control borders (>= 3:1 vs surface)|
| `--color-text-1`         | `#FAFAF9` | Primary text (stone-50)                      |
| `--color-text-2`         | `#D6D3D1` | Secondary text (stone-300)                   |
| `--color-text-3`         | `#B8B2AD` | Tertiary — placeholders, timestamps, labels  |
| `--color-accent`         | `#FB923C` | Accent brand / primary action (orange-400)   |
| `--color-accent-hover`   | `#F97316` | Accent hover state (orange-500)              |
| `--color-accent-subtle`  | `rgba(251,146,60,0.10)` | Subtle accent tint background    |
| `--color-accent-text`    | `#1C1917` | Text on accent button (dark text on light orange)|
| `--color-ok`             | `#86EFAC` | Success text (green-300)                     |
| `--color-ok-bg`          | `#143823` | Success badge background                     |
| `--color-warn`           | `#FDE047` | Warning text (yellow-300)                    |
| `--color-warn-bg`        | `#3B3314` | Warning badge background                     |
| `--color-bad`            | `#FCA5A5` | Danger / error text (red-300)                |
| `--color-bad-bg`         | `#3E1C1C` | Danger badge background                      |
| `--color-bad-button`     | `#F87171` | Destructive action button fill (red-400)     |
| `--color-bad-button-hover` | `#EF4444` | Destructive button hover (red-500)         |
| `--color-bad-text`       | `#1C1917` | Text on destructive button (dark text on light red)|

### Input & Recessed Surfaces Decision

Inputs, textareas, and selects use `--color-bg-surface` (`#FFFFFF` in light, `#292524` in dark)
with `--color-border-input` for clear >= 3:1 visual boundary definition.
Placeholders, timestamps, and metadata (`--color-text-3`) reach at least 4.5:1 on ALL surfaces:
- Light: 6.01:1 on Surface, 5.76:1 on Page, 5.51:1 on Inset.
- Dark: 7.23:1 on Surface, 8.34:1 on Page, 4.90:1 on Inset.

---

## Contrast Ratios Verification (Automated Script Output)

Generated automatically by `node client/scripts/contrast.mjs` (relative luminance WCAG 2.1 formula).

```text
========================================================================
 Pelican Design System — WCAG 2.1 Contrast Ratio Verification
========================================================================

--- Light Theme ---
| Name | FG | BG | Ratio | Target | Status |
|---|---|---|---|---|---|
| Text 1 on Surface | `#1C1917` | `#FFFFFF` | 17.49:1 | 4.5:1 | PASS |
| Text 1 on Page | `#1C1917` | `#FAFAF9` | 16.74:1 | 4.5:1 | PASS |
| Text 1 on Inset | `#1C1917` | `#F5F5F4` | 16.03:1 | 4.5:1 | PASS |
| Text 2 on Surface | `#57534E` | `#FFFFFF` | 7.63:1 | 4.5:1 | PASS |
| Text 2 on Page | `#57534E` | `#FAFAF9` | 7.30:1 | 4.5:1 | PASS |
| Text 2 on Inset | `#57534E` | `#F5F5F4` | 6.99:1 | 4.5:1 | PASS |
| Text 3 on Surface (inputs/modals) | `#68625D` | `#FFFFFF` | 6.01:1 | 4.5:1 | PASS |
| Text 3 on Page | `#68625D` | `#FAFAF9` | 5.76:1 | 4.5:1 | PASS |
| Text 3 on Inset (recessed inputs/headers) | `#68625D` | `#F5F5F4` | 5.51:1 | 4.5:1 | PASS |
| Accent on Surface | `#C2410C` | `#FFFFFF` | 5.18:1 | 4.5:1 | PASS |
| Accent on Page | `#C2410C` | `#FAFAF9` | 4.96:1 | 4.5:1 | PASS |
| Accent on Inset | `#C2410C` | `#F5F5F4` | 4.75:1 | 4.5:1 | PASS |
| Accent Button Text on Accent | `#FFFFFF` | `#C2410C` | 5.18:1 | 4.5:1 | PASS |
| OK Text on OK Badge Bg | `#166534` | `#DCFCE7` | 6.49:1 | 4.5:1 | PASS |
| Warn Text on Warn Badge Bg | `#854D0E` | `#FEF9C3` | 6.38:1 | 4.5:1 | PASS |
| Bad Text on Bad Badge Bg | `#B91C1C` | `#FEE2E2` | 5.30:1 | 4.5:1 | PASS |
| Danger Button Text on Bad Button | `#FFFFFF` | `#B91C1C` | 6.47:1 | 4.5:1 | PASS |
| Input Border on Surface | `#8A847E` | `#FFFFFF` | 3.70:1 | 3.0:1 | PASS |
| Input Border on Page | `#8A847E` | `#FAFAF9` | 3.54:1 | 3.0:1 | PASS |

--- Dark Theme ---
| Name | FG | BG | Ratio | Target | Status |
|---|---|---|---|---|---|
| Text 1 on Surface | `#FAFAF9` | `#292524` | 14.52:1 | 4.5:1 | PASS |
| Text 1 on Page | `#FAFAF9` | `#1C1917` | 16.74:1 | 4.5:1 | PASS |
| Text 1 on Inset | `#FAFAF9` | `#44403C` | 9.84:1 | 4.5:1 | PASS |
| Text 2 on Surface | `#D6D3D1` | `#292524` | 10.18:1 | 4.5:1 | PASS |
| Text 2 on Page | `#D6D3D1` | `#1C1917` | 11.74:1 | 4.5:1 | PASS |
| Text 2 on Inset | `#D6D3D1` | `#44403C` | 6.90:1 | 4.5:1 | PASS |
| Text 3 on Surface (inputs/modals) | `#B8B2AD` | `#292524` | 7.23:1 | 4.5:1 | PASS |
| Text 3 on Page | `#B8B2AD` | `#1C1917` | 8.34:1 | 4.5:1 | PASS |
| Text 3 on Inset (recessed inputs/headers) | `#B8B2AD` | `#44403C` | 4.90:1 | 4.5:1 | PASS |
| Accent on Surface | `#FB923C` | `#292524` | 6.70:1 | 4.5:1 | PASS |
| Accent on Page | `#FB923C` | `#1C1917` | 7.73:1 | 4.5:1 | PASS |
| Accent on Inset | `#FB923C` | `#44403C` | 4.54:1 | 4.5:1 | PASS |
| Accent Button Text on Accent | `#1C1917` | `#FB923C` | 7.73:1 | 4.5:1 | PASS |
| OK Text on OK Badge Bg | `#86EFAC` | `#143823` | 9.23:1 | 4.5:1 | PASS |
| Warn Text on Warn Badge Bg | `#FDE047` | `#3B3314` | 9.54:1 | 4.5:1 | PASS |
| Bad Text on Bad Badge Bg | `#FCA5A5` | `#3E1C1C` | 7.97:1 | 4.5:1 | PASS |
| Danger Button Text on Bad Button | `#1C1917` | `#F87171` | 6.32:1 | 4.5:1 | PASS |
| Input Border on Surface | `#78716C` | `#292524` | 3.16:1 | 3.0:1 | PASS |
| Input Border on Page | `#78716C` | `#1C1917` | 3.65:1 | 3.0:1 | PASS |

========================================================================
SUCCESS: All 38 contrast checks passed WCAG AA requirements.
```

---

## Typography

### Fonts

- **UI text:** Schibsted Grotesk (variable weight, 400-900).
  Self-hosted via `@fontsource-variable/schibsted-grotesk`.
- **Mono:** JetBrains Mono (400, 500).
  Self-hosted via `@fontsource/jetbrains-mono`.
  Session codes, file sizes, speeds, hashes, device keys.
  `font-variant-numeric: tabular-nums` for all numeric columns.

### Type Scale

All sizes in `rem`. Base = `14px` (`0.875rem`) for body text on desktop.
Minimum font size anywhere: 12px (`0.75rem`).

| Token     | Size        | Weight | Use                                      |
|-----------|-------------|--------|------------------------------------------|
| `--t-xs`  | 0.75rem     | 500    | Table headers, badges (12px minimum)     |
| `--t-sm`  | 0.8125rem   | 400    | Captions, help text, timestamps          |
| `--t-base`| 0.875rem    | 400    | Body text, table cells                   |
| `--t-md`  | 1rem        | 500    | Form labels, nav links, emphasized body  |
| `--t-lg`  | 1.125rem    | 600    | Card titles, section headings            |
| `--t-xl`  | 1.375rem    | 700    | Page headings                            |
| `--t-2xl` | 1.75rem     | 700    | Landing heading only                     |

Line height: 1.5 for body, 1.3 for headings.

### Mobile Type (< 768px)

All `<input>`, `<select>`, and `<textarea>` elements must have
`font-size: 16px` on screens under 768px to prevent iOS auto-zoom on focus.
Body text may be 15px on mobile.

---

## Spacing Scale

4px grid.

| Token       | Value   |
|-------------|---------|
| `--sp-1`    | 4px     |
| `--sp-2`    | 8px     |
| `--sp-3`    | 12px    |
| `--sp-4`    | 16px    |
| `--sp-5`    | 20px    |
| `--sp-6`    | 24px    |
| `--sp-8`    | 32px    |
| `--sp-10`   | 40px    |
| `--sp-12`   | 48px    |
| `--sp-16`   | 64px    |

---

## Radii

| Token       | Value | Use                                      |
|-------------|-------|------------------------------------------|
| `--r-sm`    | 4px   | Badges, status pills, small chips        |
| `--r-md`    | 6px   | Buttons, inputs, table corners           |
| `--r-lg`    | 8px   | Cards, panels, modals, dropzone          |

No fully-rounded pill shapes. Status badges use `--r-sm` (4px), not
`border-radius: 9999px`.

---

## Borders & Separators

- Hairline separators: `1px solid var(--color-border)`
- Interactive control borders: `1px solid var(--color-border-input)` (>= 3:1 contrast against surrounding surface)
  Used on inputs, selects, secondary buttons, toggle buttons, and drop zone boundary.

---

## Shadows

Used only for modals/popovers:
- Light: `0 4px 16px rgba(0,0,0,0.12)`
- Dark: `0 4px 16px rgba(0,0,0,0.4)`
No drop shadows on cards, buttons, or panels.

---

## Focus States

Every interactive element receives on `:focus-visible`:
```css
outline: 2px solid var(--color-accent);
outline-offset: 2px;
```
Visible keyboard focus in both light and dark themes.

---

## Motion Rules

- Modal fade: `150ms ease` (fade only, no slide)
- Mobile menu: appears and disappears **instantly** (no slide)
- Progress bar width: `150ms ease`
- No bouncing, pulsing, spring, or entrance animations
- `@media (prefers-reduced-motion: reduce)`: all transition/animation durations set to `0ms`

---

## Icon Approach

- **Source:** `lucide-react`
- **Stroke width:** 1.5 (consistent)
- **Sizes:** 16px inline with text, 20px in buttons/nav, 24px in empty states
- **Colour:** `currentColor`
- **No emoji anywhere**
- Icon-only buttons always have an accessible `aria-label`

---

## Accessibility

- Progress bars: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label`.
- Connection status line: `aria-live="polite"` region.
- Icon-only buttons: `aria-label` describing action.
- File drop zone: keyboard-operable (`Enter` and `Space` open file picker, `tabIndex={0}`, `role="button"`).
- Shared `Modal.jsx`: focus trap, Escape to close, click-outside to close, focus returned to trigger element.
- Session code copy: "Copied" text in an `aria-live="polite"` indicator for 2 seconds. Fallback for non-secure contexts: select text and instruct user to copy manually.

---

## Route Titles & Plain Loading

- Route titles set dynamically via `document.title`:
  - `/` → "Pelican"
  - `/session/:code` → "Session ABC123 - Pelican"
  - `/history` → "History - Pelican"
  - `/devices` → "Devices - Pelican"
  - `/login` → "Log in - Pelican"
  - `/register` → "Create account - Pelican"
  - `*` → "Page not found - Pelican"
- Loading states: plain text "Loading..." in the content area with no spinners or skeleton shimmer animations.

---

## Navbar

### Desktop (>= 768px)

- **Left:** "Pelican" wordmark (Schibsted Grotesk, 700 weight, letter-spacing -0.02em).
- **Centre-left:** Nav links — "Transfer" (always). "History" and "Devices" are **visible only when logged in** (completely hidden when logged out).
- **Right:** Theme toggle button (sun/moon icon), and auth status:
  - Logged in: device/user name + "Log out" button.
  - Logged out: "Log in" link and "Create account" button.
- 1px hairline bottom border (`var(--color-border)`).

### Mobile (< 768px)

- **Top bar:** wordmark left; theme toggle + hamburger menu button right.
- **Menu panel:** full-width panel appearing **instantly** (no slide) below header.
  - Focus-trapped while open.
  - Closes instantly on Escape, outside tap, or route navigation.
  - Shows "Transfer" (always).
  - When logged in: shows "History", "Devices", and user info + "Log out".
  - When logged out: shows "Log in" and "Create account" (History and Devices hidden).

---

## Screen Layouts

### Landing (`/`)

Single column, max-width 480px, centred. No hero section, no marketing hype.
1. "Pelican" title context, short secondary line: "Send files directly between devices. Nothing is stored on our server."
2. "This device" name input, pre-filled from `localStorage`.
3. "New session" primary accent button.
4. Divider: "or join an existing session".
5. 6-character uppercase monospace code input + "Join session" button.

### Session (`/session/:code`)

1. **Session bar:**
   - Session code (large JetBrains Mono, spaced, copy button with 2s "Copied" polite announcement).
   - Status line in `aria-live="polite"` region:
     - `connecting` → "Connecting..."
     - `waiting-peer` → "Waiting for the other device"
     - `connected` → "Connected to {remoteDeviceName}"
     - `disconnected` → "Peer disconnected"
     - `failed` → "Connection failed"
   - QR button (opens `QrCodeModal`).
2. **Controls bar** (when active): expiry time, "+15 min" and "Close session" buttons.
3. **Drop zone:** dashed border (`--color-border-input`), keyboard operable. Disabled state when waiting for peer.
4. **Transfer queue:** clean tabular rows. Monospace file size, speed, ETA, hash. Real `role="progressbar"`.
5. **Session-ended states:**
   - Plain message when expired (`SESSION_EXPIRED`), not found (`INVALID_CODE`), room full (`ROOM_FULL`), or failed.
   - Primary "New session" button, secondary "Enter a different code" link.

### History (`/history`)

1. Header with record count and "Clear all" button (opens custom `ConfirmDialog`).
2. Filter bar: search, status filter, date range, apply button.
3. Desktop (>= 768px): dense table with tabular numerals.
4. Mobile (< 768px): compact stacked rows with inline delete button (no swipe). Badges use `--r-sm` (4px).

### Devices (`/devices`)

1. Header with "Register device" toggle button.
2. Form: name and key inputs.
3. List: inline editable name (pencil icon), device key in secondary mono, last seen timestamp, trust toggle button, delete button (opens custom `ConfirmDialog`).

### Login (`/login`) & Register (`/register`)

Centred panel (max-width 400px), hairline border, no drop shadow. Clean labels, inline error messages, accent submit button, link to switch between login/register.

### Shared Modal (`Modal.jsx`)

Shared accessible dialog wrapper:
- Focus trap inside dialog
- Escape key closes
- Outside click / backdrop tap closes
- Focus returns to trigger button on close
- Fade animation (150ms), 0ms under `prefers-reduced-motion: reduce`

---

## localStorage Keys & Migration

| Old key                 | New key               | Migration logic                                     |
|-------------------------|-----------------------|-----------------------------------------------------|
| `droprelay_device_name` | `pelican_device_name` | Copy old → new, delete old. Wrapped in try/catch.   |
| `token`                 | `token` (unchanged)   | Preserved to prevent logging users out.             |
| —                       | `pelican_theme`       | `"light"` or `"dark"`.                              |

---

## Implementation Order

- **(a) Foundation:** Design tokens (`tokens.css`, `reset.css`, `components.css`, `layouts.css`), `contrast.mjs`, `Navbar.jsx`, `ThemeToggle.jsx`, `Modal.jsx`, `ConfirmDialog.jsx`.
- **(b) Entry & Auth:** `LandingPage.jsx`, `LoginPage.jsx`, `RegisterPage.jsx`, `NotFoundPage.jsx`.
- **(c) Transfer Core:** `SessionPage.jsx`, `DropZone.jsx`, `TransferQueue.jsx`, `StatusBadge.jsx`, `QrCodeModal.jsx`.
- **(d) Management:** `HistoryPage.jsx`, `DevicesPage.jsx`.
- **(e) Polish & Cleanup:** Final rename commit for comments in transfer engine files.
