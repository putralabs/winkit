---
name: WinKit
description: Your Everyday File Toolkit - calibration bench for everyday files
colors:
  workbench-royal blue: "#002bcd"
  workbench-royal blue-bright: "#5b6cff"
  workbench-ink: "#111b45"
  bench-black: "#0a1330"
  action-orange: "#ea580c"
  paper: "#f2f4ff"
  card-white: "#ffffff"
  mist: "#e8ecfa"
  slate-text: "#4a5678"
  mint-border: "#c5cfff"
  signal-red: "#dc2626"
  night-bg: "#0b0f1e"
  night-card: "#131a33"
  night-border: "#26305c"
  night-text: "#f4f6ff"
  night-muted: "#a2abcd"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif"
    fontSize: "clamp(3rem, 8vw, 6rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 800
    letterSpacing: "0.08em"
  micro:
    fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 800
    letterSpacing: "0.14em"
  measure:
    fontFamily: "ui-monospace, Cascadia Mono, JetBrains Mono, Menlo, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 700
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.action-orange}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 32px"
  button-primary-hover:
    backgroundColor: "{colors.action-orange}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 32px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.workbench-royal blue}"
    rounded: "{rounded.md}"
    padding: "10px 28px"
  chip:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.workbench-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.workbench-ink}"
    rounded: "{rounded.md}"
    padding: "12px"
  input-search:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.workbench-ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px 10px 36px"
  nav-item-active:
    backgroundColor: "{colors.workbench-royal blue}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  readout-stat:
    backgroundColor: "{colors.bench-black}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
---

# Design System: WinKit

## Overview

**Creative North Star: "The Calibration Bench"**

WinKit looks like a precision bench where every file is measured before it is
made: hairline tick scales rule the dividers, dark readout panels report exact
bytes in tabular numerals, and a single action orange speaks only when something
must be pressed. Paper stays light so the instrument panels read as instruments.
Density is dashboard-tight (2–32px rhythm) with more space above a heading than
below it; the landing hero is the one allowed shout, set in oversized display type.

Motion is one authored moment per surface, exponential ease-out from an
already-visible default, dead on arrival under `prefers-reduced-motion`. The
night world swaps the palette, never the layout.

**Key Characteristics:**
- Tick scales and readout panels; measurement is the decoration.
- Royal blue depth + one orange voice, flat paper everywhere else.
- Display type quarantined to the landing hero; tabular numerals for every number that matters.
- Everything reachable by keyboard; every control names its action.

## Colors

Royal blue measures, orange asks, ink-black panels report, neutrals hold.

### Primary
- **Signal Royal Blue** (#002bcd, sampled from `logo/logo.png` mean rgb(0,43,205)): focus, active states, focus rings, tick scales. The color of "you are in good hands."

### Secondary
- **Workbench Royal blue Bright** (#5b6cff): icon chips, hover washes, mesh light. Never body text.

### Tertiary
- **Action Orange** (#ea580c): the single CTA voice - Convert, Download, Open. Its rarity is the point.

### Neutral
- **Paper** (#f2f4ff): app background, light mode.
- **Card White** (#ffffff): surfaces that hold tools and files.
- **Bench Black** (#0a1330): readout panels - deep royal blue-ink, never pure black in light mode.
- **Mist** (#e8ecfa): chips, wells, hover fills.
- **Slate Text** (#4a5678): secondary text on light (4.5:1-safe).
- **Mint Border** (#c5cfff): hairlines on light.
- **Night Bg** (#0b0f1e), **Night Card** (#131a33), **Night Border** (#26305c), **Night Text** (#f4f6ff), **Night Muted** (#a2abcd): the night world, same layout.
- **Signal Red** (#dc2626): errors and destructive actions only.

### Named Rules
**The One Voice Rule.** Action orange appears on ≤10% of any screen - primary
actions only. If everything is urgent, nothing is.
**The Tinted Text Rule.** On colored surfaces, secondary text is tinted from that
hue or the foreground - never gray.
**The True Black Rule.** Light mode never uses pure black; the darkest surface is
bench black with royal blue in it.

## Typography

**Display Font:** Plus Jakarta Sans (self-hosted, Fontsource) with Inter fallback.
Brand-committed by the user; kept deliberately against the novelty reflex.
**Body Font:** Plus Jakarta Sans (same stack - one voice, two volumes).
**Measure Font:** system monospace stack - measurements only, never headlines or prose.

**Character:** Geometric-humanist, confident at 800 and invisible at 400. Numbers
that matter are tabular; numbers that decorate don't exist.

### Hierarchy
- **Display** (800, clamp(3rem, 8vw, 6rem), line-height 1, tracking −0.03em): landing hero headline only.
- **Headline** (800, 1.875rem/30px, 1.2): section titles, tool names in headers.
- **Title** (700–800, 0.875–1rem): card titles, panel headings.
- **Body** (400–500, 0.75–0.875rem, 1.6): descriptions, file rows, helper text.
- **Label** (800, 0.6875rem/11px, +0.08em, uppercase): Continue cards, kbd hints, section tags.
- **Micro** (800, 0.625rem/10px, +0.14em, uppercase): instrument readout labels, version tags. Smallest step; machine annotations only.
- **Measure** (700, system mono, tabular-nums): byte counts, percentages, durations, page counts. Data, never voice.

### Named Rules
**The Display Quarantine Rule.** Display size lives on the landing hero and
nowhere else. App surfaces top out at headline.
**The Mono Measure Rule.** Monospace appears if and only if the string is a
measurement. A headline set in mono is a costume, not a readout.

## Layout

Single-column workspaces capped by measure: app at max 48rem, marketing at 72rem,
sidebar rail fixed at 13rem. Marketing rhythm alternates: hero peak, procedure,
index, dark close. Density runs tight-to-generous by feel - groups at 12–16px,
sections at 48px+ - with more space above a heading than below it. The popup stays usable at 360px.

## Elevation & Depth

Flat by default; shadows answer interaction. Readout panels carry no shadow -
their darkness is the depth.

### Shadow Vocabulary
- **Resting lift** (`0 1px 2px rgba(0,0,0,0.05)`): icon chips, subtle separation.
- **Hover lift** (`0 4px 6px rgba(0,0,0,0.1)`): cards and buttons under the pointer.
- **Overlay** (`0 10px 15px rgba(0,0,0,0.1)`): palette panel, dropdowns.
- **Hero** (`0 20px 25px rgba(0,0,0,0.15)`): instrument panel and dark close card.

### Named Rules
**The Flat-By-Default Rule.** A shadow without a preceding hover, press, or
overlay state is decoration - remove it.

## Shapes

Confident but quiet: small controls at 8px, cards and inputs at 12px, feature
panels at 16px, chips fully round. Readout panels share the 12–16px card radius
so instruments feel built, not overlaid. Tick scales are 8–14px hairline strips,
never filled bars.

## Components

### Buttons
- **Shape:** confident 12px corners.
- **Primary:** action orange fill, white text, 12px 32px padding.
- **Hover / Focus:** opacity to 90% plus a half-step lift; visible 2px royal blue focus ring with 2px offset. Press settles back.
- **Secondary / Ghost:** transparent fill, 2px royal blue outline; border-only quiet buttons for destructive resets (redden on hover).

### Chips
- **Style:** mist fill, ink text, full pill, 6px 12px.
- **State:** hover swaps to royal blue fill + white text; selected state is royal blue fill.

### Cards / Containers
- **Corner Style:** 12px, 16px for feature panels.
- **Background:** card white (night card after dark).
- **Shadow Strategy:** flat at rest per Elevation; hover lift per the vocabulary.
- **Border:** 1px mint (night-border after dark).
- **Internal Padding:** 12–20px on tool cards, 16–24px on panels.

### Inputs / Fields
- **Style:** white fill, 1px mint stroke, 12px corners; search carries a left icon and 36px left padding.
- **Focus:** border shifts to royal blue with a soft 2px royal blue/20 ring. Range sliders use royal blue accents - orange only on the dark instrument dial.
- **Error / Disabled:** destructive text with a red-tinted border; disabled controls dim, never vanish.

### Navigation
- Rail items are medium-weight muted rows; hover nudges right with a mist fill; the active item is a solid royal blue pill with white text and shadow. Tick strips rule the rail top and footer with mono session counts. Top search is sticky with backdrop blur, `/` hint, and a ⌘K palette trigger.

### Command Palette
- Signature component: panel top-anchored at 14vh, royal blue-highlighted cursor row with white text, category pills, ↑↓/↵/esc footer, recent section on empty query. Opens on Ctrl/⌘+K from anywhere except text fields.

### Bench Instrument
- Signature component: dark readout panel - labeled measurement cells in tabular mono (input, output, saved), thumbnail pair, calibration tick strip over the quality dial, live status line. The landing hero's proof.

## Do's and Don'ts

Concrete guardrails from the shipped implementation.

### Do:
- **Do** keep action orange to primary actions only (The One Voice Rule).
- **Do** set every number that matters in tabular numerals - bytes, percents, counts.
- **Do** use tick scales where measurement happens; nowhere else.
- **Do** lift cards on hover and settle them on press - depth is feedback.
- **Do** honor `prefers-reduced-motion` with final-state rendering, not slowed motion.
- **Do** draw every icon as inline SVG in one 1.8–2px stroke; no emoji, no glyphs-as-icons.
- **Do** write controls that name their action and errors that name the recovery.
- **Do** keep display type quarantined to the landing hero.

### Don't:
- **Don't** use pure black in light mode (The True Black Rule).
- **Don't** set headlines or prose in monospace (The Mono Measure Rule).
- **Don't** put ambient shadows on resting cards (The Flat-By-Default Rule).
- **Don't** add a color, font, or radius the system doesn't own - ask first.
- **Don't** use kickers/eyebrows above headings; headings carry their own weight.
- **Don't** nest cards; one surface, one container.
- **Don't** ship a new surface without keyboard path, focus ring, and empty/error states.
- **Don't** fabricate testimonials, metrics, or claims the product hasn't earned.
