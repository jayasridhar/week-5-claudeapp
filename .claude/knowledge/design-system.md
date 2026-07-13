# Anthropic / Claude Design System

**Inspired by:** claude.ai product UI and anthropic.com marketing site

---

## Brand Aesthetic

Clean, warm, minimal. Thoughtful whitespace. No decoration that doesn't earn its place.
The interface should feel like a calm, intelligent tool — not flashy, not cold.
Dark mode is the primary product experience (chat interface).
Light mode for auth / marketing-adjacent surfaces.

---

## Color System

Token prefix: `an-` (e.g. `bg-an-bg-base`, `text-an-fg-subtle`)

### Dark Mode (product — dashboard, chat)

| Token | Hex | Use |
|---|---|---|
| `an-bg-base` | `#1A1917` | Page / app background |
| `an-bg-subtle` | `#222220` | Sidebar, secondary surfaces |
| `an-bg-surface` | `#2A2927` | Cards, input fields, elevated surfaces |
| `an-bg-elevated` | `#333230` | Dropdowns, modals, tooltips |
| `an-border-base` | `rgba(255,255,255,0.08)` | Default dividers and borders |
| `an-border-strong` | `rgba(255,255,255,0.14)` | Focused inputs, active states |
| `an-fg-base` | `#F2EFE9` | Primary text |
| `an-fg-subtle` | `#9B9793` | Secondary text, placeholders, metadata |
| `an-fg-muted` | `#6B6864` | Disabled text, timestamps |
| `an-fg-inverted` | `#1A1917` | Text on accent backgrounds |
| `an-accent` | `#D97757` | Primary accent — coral/terracotta |
| `an-accent-hover` | `#C96B49` | Accent hover state |
| `an-accent-subtle` | `rgba(217,119,87,0.15)` | Accent tint for backgrounds |
| `an-success` | `#5B9B6B` | Success states |
| `an-warning` | `#C9963A` | Warning states |
| `an-error` | `#C05B5B` | Error states |

### Light Mode (auth, login, signup pages)

| Token | Hex | Use |
|---|---|---|
| `an-bg-base` | `#FAF9F7` | Page background |
| `an-bg-subtle` | `#F2F0EC` | Input backgrounds, cards |
| `an-bg-surface` | `#ECEAE5` | Elevated surfaces |
| `an-border-base` | `rgba(0,0,0,0.08)` | Default borders |
| `an-border-strong` | `rgba(0,0,0,0.18)` | Focused inputs |
| `an-fg-base` | `#1A1917` | Primary text |
| `an-fg-subtle` | `#6B6864` | Secondary text |
| `an-fg-muted` | `#9B9793` | Placeholders |
| `an-accent` | `#D97757` | Coral accent (same value) |
| `an-accent-hover` | `#C96B49` | |
| `an-accent-subtle` | `rgba(217,119,87,0.12)` | Tint backgrounds |

### Tailwind Config

```js
// tailwind.config.ts — extend colors
colors: {
  an: {
    'bg-base':     'var(--an-bg-base)',
    'bg-subtle':   'var(--an-bg-subtle)',
    'bg-surface':  'var(--an-bg-surface)',
    'bg-elevated': 'var(--an-bg-elevated)',
    'border':      'var(--an-border-base)',
    'border-strong': 'var(--an-border-strong)',
    'fg-base':     'var(--an-fg-base)',
    'fg-subtle':   'var(--an-fg-subtle)',
    'fg-muted':    'var(--an-fg-muted)',
    'fg-inverted': 'var(--an-fg-inverted)',
    'accent':      'var(--an-accent)',
    'accent-hover':'var(--an-accent-hover)',
    'accent-subtle':'var(--an-accent-subtle)',
  }
}
```

---

## Typography

### Fonts

| Role | Font | Fallback |
|---|---|---|
| UI sans (body, labels, inputs) | **Inter** | system-ui, sans-serif |
| Display / hero | **Lora** | Georgia, serif |
| Monospace (code, contract text) | **JetBrains Mono** | monospace |

```html
<!-- globals.css @import -->
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600&family=Lora:wght@500;600&family=JetBrains+Mono:wght@400;500&display=swap');
```

### Scale

| Name | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `text-display` | 28px | 500 | 1.2 | Page titles, auth hero |
| `text-title` | 18px | 500 | 1.3 | Section headings |
| `text-body` | 14px | 400 | 1.6 | Default body, message text |
| `text-body-sm` | 13px | 400 | 1.5 | Sidebar labels, metadata |
| `text-caption` | 12px | 400 | 1.4 | Timestamps, helper text |
| `text-mono` | 13px | 400 | 1.6 | Contract text, code blocks |
| `text-label` | 12px | 500 | 1 | Buttons, tabs, badges |

---

## Spacing & Layout

### App Shell (dashboard)

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar 256px  │  Chat area flex-1  │  Right panel 304px │
│  bg-subtle      │  bg-base           │  bg-subtle          │
└─────────────────────────────────────────────────────────┘
```

| Zone | Width | Background |
|---|---|---|
| Sidebar | 256px (fixed) | `an-bg-subtle` |
| Center / chat | `flex-1` | `an-bg-base` |
| Right panel | 304px (fixed) | `an-bg-subtle` |

### Sidebar

- Top: Logo + app name (24px padding)
- Middle: Session list (scrollable, 0 padding-x on container, 8px padding on items)
- New Chat button: full-width, just below logo area
- Bottom: User avatar + email + logout (pinned, 16px padding)

### Chat Area

- Messages: max-width `680px`, centered in the flex-1 column
- Composer: pinned to bottom, same max-width, 24px padding bottom
- Message list: padding 24px 0, gap 24px between messages

### Spacing Units (multiples of 4)

```
4px  — tight gaps (icon + label)
8px  — small padding (chips, tags)
12px — compact padding (sm buttons, badges)
16px — standard component padding
20px — medium spacing
24px — section padding
32px — large gaps between sections
40px — page-level breathing room
```

---

## Components

### Buttons

```
Primary   — bg: an-accent, text: white, hover: an-accent-hover
           border-radius: 6px, height: 36px, px: 16px
           font: 14px/500

Ghost     — bg: transparent, text: an-fg-base, border: 1px an-border
           hover: bg-an-bg-surface

Danger    — bg: an-error tinted, text: an-error
           hover: slightly more opaque
```

All buttons: `transition duration-150 ease-out`, no shadow.

### Input Fields

```
height: 36px (single line), padding: 0 12px
background: an-bg-surface
border: 1px solid an-border-base
border-radius: 6px
text: 14px an-fg-base
placeholder: an-fg-muted
focus: border-color an-border-strong, outline: none
```

### Chat Composer

```
Container: bg-an-bg-surface, border: 1px an-border-base
border-radius: 12px, padding: 12px 16px
Textarea: borderless, bg transparent, resize: none
          auto-expand up to 200px
Send button: coral accent, 32px circle, bottom-right
```

### Message Bubbles

```
User message:
  background: an-accent-subtle
  border: 1px solid rgba(217,119,87,0.20)
  border-radius: 12px 12px 4px 12px
  padding: 12px 16px
  align: right (max-width 75%)

Assistant message:
  background: none
  text: an-fg-base directly on bg-base
  No bubble border
  Prefix: small coral dot or Claude icon (16px)
  align: left (full max-width 680px)
```

### Sidebar Session Item

```
height: 36px, padding: 0 12px
border-radius: 6px
default: bg transparent, text: an-fg-subtle
hover: bg-an-bg-surface, text: an-fg-base
active: bg-an-bg-elevated, text: an-fg-base
Title: 13px truncated to 1 line
Date: 12px an-fg-muted, right-aligned
```

### Cards / Panels

```
background: an-bg-surface
border: 1px solid an-border-base
border-radius: 8px
padding: 16px
```

### Badges / Status Chips

```
height: 20px, padding: 0 8px
border-radius: 10px (pill)
font: 11px/500 uppercase tracking-wide
background: an-accent-subtle, text: an-accent (for active)
background: an-bg-surface, text: an-fg-muted (for neutral)
```

---

## Iconography

- **Library:** Lucide React
- **Stroke width:** 1.5px
- **Default size:** 16px (UI), 20px (sidebar nav), 14px (inline with text)
- **Color:** inherit from parent text color
- No filled icons in product UI.

---

## Motion

```
duration: 100–150ms
easing: cubic-bezier(0.16, 1, 0.3, 1)  /* ease-out-expo */

Standard transitions:
  opacity: 0 → 1 (150ms) for panels, modals
  translateY(4px) → 0 with opacity for dropdown entrances
  background-color on hover (100ms)

Never:
  bounce, spring, or scale transforms in product UI
  Animations longer than 200ms on repeated interactions
```

```css
/* globals.css */
.an-fade-in {
  animation: anFadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes anFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## CSS Variables Setup

```css
/* globals.css — dark mode (default) */
:root {
  --an-bg-base:       #1A1917;
  --an-bg-subtle:     #222220;
  --an-bg-surface:    #2A2927;
  --an-bg-elevated:   #333230;
  --an-border-base:   rgba(255,255,255,0.08);
  --an-border-strong: rgba(255,255,255,0.14);
  --an-fg-base:       #F2EFE9;
  --an-fg-subtle:     #9B9793;
  --an-fg-muted:      #6B6864;
  --an-fg-inverted:   #1A1917;
  --an-accent:        #D97757;
  --an-accent-hover:  #C96B49;
  --an-accent-subtle: rgba(217,119,87,0.15);
  --an-success:       #5B9B6B;
  --an-warning:       #C9963A;
  --an-error:         #C05B5B;
}

/* Light mode override (auth pages) */
[data-theme="light"] {
  --an-bg-base:       #FAF9F7;
  --an-bg-subtle:     #F2F0EC;
  --an-bg-surface:    #ECEAE5;
  --an-bg-elevated:   #E4E2DC;
  --an-border-base:   rgba(0,0,0,0.08);
  --an-border-strong: rgba(0,0,0,0.18);
  --an-fg-base:       #1A1917;
  --an-fg-subtle:     #6B6864;
  --an-fg-muted:      #9B9793;
  --an-fg-inverted:   #FAF9F7;
  --an-accent-subtle: rgba(217,119,87,0.12);
}
```

---

## Copy / Voice

- No emoji anywhere in the product UI
- Sentence case for all labels, headings, buttons
- Active voice, short sentences
- "you" for the user, "Claude" or "the assistant" for AI responses
- Legal vocabulary used naturally — do not simplify or avoid terms
- No filler phrases ("Please note that...", "In order to...")
- Error messages: say what happened and what to do, not just a code

---

## Inferences / Decisions

1. **Typography:** Inter (sans) replaces Söhne — closest free match; Lora for display (warm serif, closer to Anthropic's editorial feel than Cormorant)
2. **Accent color:** `#D97757` — derived from Anthropic brand coral; confirmed present in Claude UI buttons and highlights
3. **Dark backgrounds:** warm near-black hue aligned to `#1A1917` (matches claude.ai surface palette)
4. **No gradients on surfaces** — flat, layered approach matching Claude product aesthetic
5. **Message bubbles:** user has subtle tinted bubble; assistant has no bubble (matches claude.ai behavior)
6. **Lucide icons:** stroke-only, 1.5px — consistent with Claude UI icon treatment
