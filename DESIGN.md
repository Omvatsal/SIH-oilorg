---
version: alpha
name: "SETU"
description: "A restrained site-execution workspace for reviewing evidence against construction schedules."
colors:
  background: "#fbf6ee"
  surface: "#fffdf8"
  text: "#2b1d14"
  muted: "#6e5a48"
  border: "#e9dbc5"
  primary: "#b34a12"
  success: "#4e7a3a"
  warning: "#b7791f"
  danger: "#a32a1e"
  focus: "#7b4b5e"
typography:
  sans:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
  mono:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
rounded:
  DEFAULT: "6px"
  card: "8px"
spacing:
  page-gutter: "44px"
  section-gap: "32px"
components:
  button: {}
  panel: {}
  badge: {}
  table: {}
---

# SETU Design System

## Overview

SETU is an operations workspace for site engineers and planners. Its reference is a well-kept construction log: evidence, activity IDs, and decisions are easy to scan, with no promotional layout inside the product. The memorable element is the clear before-and-after change row next to its source evidence. Four routes follow the user's task order: Import, Reports, Review, Schedule.

The UI is English-first and uses Asia/Kolkata for reported time displays. It must remain usable on a laptop at a site office and on a phone for field reporting. The interface favors direct labels and short recovery instructions. Avoid decorative gradients, oversized statistics, nested cards, and speculative schedule visuals.

Runtime CSS in `frontend/src/styles/palette.css` and `frontend/src/styles/tokens.css` is canonical. This document records the approved values and intent; edits to durable tokens should update both the CSS and this file.

## Colors

Preserve the existing sand, terracotta, olive, amber, brick, and plum palette. Surfaces and borders carry hierarchy. Primary is for the next task action; olive means safe/applied, amber means review, brick means blocked/error, and plum is the keyboard focus ring. Status is always stated in text as well as color.

## Typography

System sans keeps labels and reports legible without a network font dependency. Monospace is reserved for IDs, counts, and measured quantities. Page titles are compact; tables and review rows prioritize comparison over display typography.

## Layout

A desktop sidebar and mobile bottom navigation keep the four destinations stable. The desktop sidebar may collapse to centered icons; hovering temporarily expands it and its pin control sets the persistent state. Main content is bounded and uses task-specific grids, while long tables own their own scroll area. Mobile pages scroll naturally above the navigation. Controls and notifications retain their dimensions as state changes.

## Elevation & Depth

Borders, surface contrast, and spacing create hierarchy. Only transient feedback may use a subtle shadow. Page sections are unframed; panels frame actual tools such as upload forms and the safety decision area.

## Shapes

Controls use 6px corners and framed panels use 8px. Tables and evidence rows rely on straight dividers. No decorative pills or large rounded containers.

## Components

Buttons use primary, secondary, and quiet treatments with visible focus and disabled states. Badges use one shared semantic mapping. Forms show errors in text and retain input after failure. Uploads use explicit file selection and action. Review decisions remain in a consistent location and show the current patch state. Loading and empty states say what the user can do next.

The report date uses the native date picker; its platform-owned calendar is acceptable for this English-first demo. Long field messages use a fixed-height textarea with document scrolling.

The Schedule route shows planned activity dates, status, overdue work, and the dependency map from the import response. The Reports route queues up to ten report files and submits them sequentially so each source joins the same pending report.
Reported time ranges use a 24-hour track in India Standard Time with confidence and exact bounds; the Review route lists activities past their planned finish. Neither implies a project completion forecast.

## Do's and Don'ts

- Do keep evidence beside proposed changes and use real activity IDs and report data.
- Do keep action names and status meanings consistent across routes.
- Don't imply that a finding has been resolved just because a clarification answer was recorded.
- Don't add placeholder analytics or a Gantt chart without corresponding data.
