# Nudgra Design

## Purpose

This file defines the visual direction for Nudgra so future UI work stays consistent with the product and with the existing design tokens.

It is a design reference, not an implementation of new styles.

## Design Goal

Nudgra should feel:

- clear
- modern
- calm
- operational
- lightweight

It should not feel:

- noisy
- overly playful
- dark and moody
- SaaS-generic with random gradients and hard-coded colors everywhere

The product is about ownership and control, so the interface should communicate confidence and clarity rather than visual excess.

## Core Direction

The intended direction is a clean light UI built on white, slate neutrals, and blue primary actions.

This means:

- white and near-white surfaces
- dark slate text
- restrained use of blue for primary actions, focus states, and emphasis
- subtle borders and separators
- rounded but not overly soft components
- low visual noise

## No Dark Mode

Nudgra should be designed as a light-first product.

For current UI work:

- do not design new screens around dark mode
- do not make dark mode part of the product direction
- do not rely on dark-specific styling as a core experience

Even if dark tokens exist in `app/globals.css`, the intended product direction is light mode.

## Source Of Truth

The visual token system defined in `app/globals.css` is the source of truth for colors, radii, and semantic styling.

The component strategy is based on `shadcn`.

Future UI work should prefer:

- semantic tokens such as `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, and `text-primary-foreground`
- the existing theme variables and shadcn-compatible setup
- the existing Tailwind token mapping already defined in the project
- `shadcn` components added on demand as the product grows

Future UI work should avoid:

- inventing a second parallel color system
- hard-coding unrelated palettes without a strong reason
- styling that ignores the semantic token structure already present

## Color Direction

The current design system points to this palette behavior:

- `background`: white
- `foreground`: dark slate
- `primary`: blue-leaning accent for actions
- `secondary` and `muted`: slate-100 style neutrals
- `border` and `input`: soft slate borders

In practice:

- primary buttons should use the blue primary token
- neutral surfaces should stay white or very light slate
- supporting UI should use muted neutrals instead of extra accent colors
- destructive states should be reserved for actual errors and destructive actions

## Typography

Typography should feel clean and product-focused.

Guidelines:

- use the configured sans font as the default interface font
- use the heading font token for headings instead of inventing separate hero fonts
- use the mono font only for technical values, logs, IDs, or code-like content
- keep headings strong and readable, not ornamental

## Layout Style

The layout style should be structured and product-oriented:

- generous spacing
- clear content hierarchy
- readable sections
- simple visual grouping through cards, panels, borders, and muted backgrounds
- intentional use of empty space

Do not build pages that depend on heavy decoration to feel finished.

## Component Style

Components should follow the same visual language:

- cards on white or soft muted surfaces
- subtle borders
- blue primary CTAs
- neutral secondary actions
- consistent radius from the global token system
- restrained shadows, if any

The UI should feel more like a reliable dashboard product than a marketing experiment.

## Shadcn Usage

Nudgra is using `shadcn` for UI components.

That means:

- do not try to prebuild every component upfront
- add components only when a screen actually needs them
- keep generated components aligned with the existing token system
- customize them only enough to match the Nudgra design direction

The goal is to keep the component layer practical and easy to extend.

## Interaction Style

Interaction should be simple and quiet:

- fast hover feedback
- clear focus states
- minimal animation
- no dramatic motion as a default pattern

Animation should support clarity, not become a visual theme by itself.

## Product Surfaces

### Landing Page

The landing page should communicate:

- what Nudgra is
- why it exists
- what it automates
- why it is cheaper and more controlled than hosted alternatives

### App Dashboard

The dashboard should prioritize:

- account connection
- rules
- contacts
- conversations
- logs
- failures

It should look operational and trustworthy, not overly promotional.

## Implementation Rules

When building future UI in this repo:

- respect the design tokens already defined in `app/globals.css`
- stay in light mode
- prefer semantic Tailwind classes over hard-coded color values
- keep the palette restrained
- use `shadcn` as the base component system
- install or add `shadcn` components as needed instead of building unused UI upfront
- do not introduce a conflicting aesthetic direction page by page

## Summary

Nudgra design should feel like a clean operator tool built on white, slate, and blue.

The visual system should be consistent, light, and controlled.

The design should support trust, clarity, and usability before style experimentation.
