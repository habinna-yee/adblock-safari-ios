---
version: alpha
name: Harbor
description: A quiet, nautical instrument panel for Safari protection.
colors:
  primary: "#086e83"
  background: "#eef4f6"
  surface: "#ffffff"
  text: "#172f3d"
  muted: "#536c78"
  border: "#cad9df"
  danger: "#a12a32"
  focus: "#ac5900"
typography:
  sans:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
rounded:
  DEFAULT: "16px"
  control: "10px"
spacing:
  panel: "20px"
  gap: "16px"
  page-max: "820px"
components:
  button:
    height: "44px"
  toggle:
    height: "56px"
---
# Harbor design system

## Overview
Harbor is a product tool for people who want desktop-like control of Safari on iPhone. The reference is a small navigation instrument: a steady teal beacon identifies configured protection, backed by plain switches and legible labels. No invented protection percentages, threat dashboards, gradients, or dashboard theatrics. The signature is the beacon paired with a compact monospaced website label.
English is the initial interface language; locale-aware dates and numbers follow the device. No particular national market is assumed. Native text fonts and familiar touch controls take precedence over expressive branding. Token ownership is Extension/ui.css; this document mirrors its light-theme values. The containing app uses the same teal and system font.

## Colors
Cool mist surfaces, dark marine text, and restrained teal actions. Red means a failed action; amber is the keyboard focus ring. Dark mode replaces surfaces with #12232c and #1a303b, text with #edf5f8, muted with #b0c6d1, teal with #7ad6e3, border with #38515e, danger with #ffadb3 and focus with #ffbc75. Global scrollbar thumb/track/hover tokens live in ui.css. Forced colors retain native semantics.

## Typography
System sans for labels and copy. Monospace for rules, restrained utility headings, and exact counts. Main titles are 30px; body is 16px with 1.5 line height; technical helpers are 13px. No external font downloads.

## Layout
A 360px Safari popup and a natural-height settings document capped at 820px. Three anchor navigation destinations preserve unsaved filter drafts. At phone widths, form rows stack and panels reduce to 16px padding. There are no tables or pagination. Exceptions are bounded to 200 and filters to 200,000 characters.

## Elevation & Depth
Borders separate control groups. No static shadows. Only the on-page element picker uses a shadow because it floats above someone else's page.

## Shapes
16px panels, 10px controls, capsule switches. The icon depicts an opening between two wave bands.

## Components
Native buttons, checkbox switches, labeled text inputs and textareas. All buttons have hover, focus, active, disabled and pending states. The shared status region reserves 48px and errors persist in text. Busy controls keep their geometry. The element picker is a deliberately non-modal region: the page must remain selectable. Escape and a visible Cancel button close it and restore focus.
No decorative motion. Reduced motion is respected. The voice explains what the user can control, and distinguishes configured blocking from Safari-granted permission. Counts describe rules, never claimed blocked requests.

## Do's and Don'ts
- Keep state transitions and error recovery identical across controls.
- Keep all local configuration usable offline.
- Do not claim every ad is removed or that permission has been granted without evidence.
- Do not use remote assets, fake counters, or marketing sections in settings.

Cookie automation shares the canonical toggle and status system; it uses known category controls, refuses ambiguous dialogs, and never treats a hidden banner as proof of consent.
