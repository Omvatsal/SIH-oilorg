---
version: alpha
name: SETU
description: A field-first construction execution desk with the feel of a working site ledger.
colors:
  primary: "#B34A12"
  background: "#FBF6EE"
  surface: "#FFFDF8"
  text: "#2B1D14"
  muted: "#6E5A48"
  success: "#3D632E"
  warning: "#80540C"
  danger: "#A32A1E"
typography:
  sans:
    fontFamily: "Arial, sans-serif"
  mono:
    fontFamily: "Consolas, monospace"
rounded:
  DEFAULT: "8px"
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  app-max: "1420px"
  section-gap: "16px"
---

# SETU Design System

## Product character

SETU is a practical tool for planners and supervisors who coordinate work between the schedule and the site. The interface should feel like a clear desk with marked-up plans: direct language, readable details, and visible work evidence. Avoid generic AI product motifs, assistant-style chat chrome, glowing gradients, and made-up forecasts.

## Visual direction

- Warm paper, ink, and rust colors follow the existing runtime palette in `frontend/src/styles/palette.css` and `tokens.css`.
- Use bold sans serif headings for fast scanning. Reserve Georgia italic for short emphasis and Consolas for IDs, dates, and small operational labels.
- Pair orderly tables and status rows with restrained field-note details: an annotated plan, stamp, pencil-like arrows, or hand-marked status.
- Keep decoration tied to real schedule or field concepts. Do not use decorative dashboard charts or invented project metrics.
- Use familiar outline SVG icons with consistent 1.7px strokes. Icons are decorative when an adjacent text label names the action.

## Layout and routes

- `/` is an editorial landing page with a direct path into the application.
- `/workspace` is the execution desk. It has a persistent project sidebar at desktop sizes and a horizontally scrollable navigation strip on narrow screens.
- Sidebar views: Planned schedule, Actual work, Progress, Punch list, Institutional memory, Settings. Keep selection in the `view` query parameter.
- The workspace uses comfortable body sizes (12–15px for supporting text, 14–18px for card content) and stronger section headings. Preserve dense schedules with table overflow rather than shrinking their type.
- At widths below 940px, work panels stack. Below 640px, cards and landing-page lanes stack.

## Interaction

- Links navigate between pages; buttons change local view state or submit work.
- Sidebar follows the vertical ARIA tabs pattern: Up/Down, Home, and End move and activate views. Keep visible focus outlines.
- Upload and approval actions preserve their current pessimistic behavior. Show errors next to the current work and keep recoverable drafts.
- Settings and identity details are clearly labeled as demo placeholders until authentication and organization settings are connected.
- Respect reduced motion. Status meaning always includes words, not color alone.

## Product boundaries

- The API prototype stores workspace data in process memory. Do not imply that session data is durable.
- The progress view reports known completion and overdue work; it does not estimate a project completion date or critical-path delay.
- Reported time intervals use a soft edged 24 hour track in India Standard Time; show the confidence and exact bounds next to each band.
- Institutional memory is not connected to a durable store yet.
