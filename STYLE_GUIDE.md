# Continuum Design System: Arc × Dia Hybrid

This document defines the visual language of Continuum, a hybrid aesthetic combining the depth and precision of **Dia** with the fluidity and glass-morphism of **Arc**.

## Core Philosophy

1.  **Obsidian Depth**: Backgrounds are not just black; they are deep, void-like spaces (`#050505`) with subtle, breathing ambient light (Aurora effects).
2.  **Glass, No Borders**: Elements define themselves through backdrop blur, subtle lighting, and shadow, rather than harsh 1px borders.
3.  **Kinetic Typography**: Text is treated as a graphical element—tightly tracked headings, relaxed body copy, using the `Inter` font family.
4.  **Minimal Chrome**: UI controls recede until needed. Scrollbars, dividers, and handles are minimal or invisible.

---

## 1. Colors & Gradients

### Backgrounds
- **Obsidian Surface**: `#050505` (Base)
- **Aurora Amber**: `hsl(33, 100%, 50%)` (Warm accents)
- **Aurora Purple**: `hsl(260, 20%, 15%)` (Deep cool depth)

### Gradients
- **Surface Gradient**: `radial-gradient(circle at 50% 0%, amber/2% 0%, transparent 45%)`
- **Card Gradient**: `linear-gradient(180deg, rgba(30,30,30,0.4), rgba(20,20,20,0.6))`
- **Text Gradient**: `linear-gradient(180deg, #ededed 0%, #a1a1aa 100%)`

---

## 2. Typography

**Font Family**: `Inter`, system-ui, sans-serif

### Headings (`.neo-dia-heading`)
- **Weight**: 500 (Medium)
- **Tracking**: `-0.03em` (Tight)
- **Effect**: Silver gradient fill, soft drop shadow.
- **Usage**: Page titles, Hero sections.

### Body Muted (`.neo-dia-text-muted`)
- **Weight**: 400 (Regular)
- **Color**: `#71717a` (Zinc-500)
- **Tracking**: `-0.01em`
- **Usage**: Secondary text, descriptions.

---

## 3. Components & Utilities

### The Glass Card (`.neo-dia-card`)
A fundamental building block.
- **Border Radius**: `16px` (Soft, Arc-like)
- **Border**: `1px solid rgba(255, 255, 255, 0.02)` (Almost invisible)
- **Backdrop**: `blur(10px)`
- **Hover State**:
    - Lifts up (`translateY(-4px)`)
    - Scales slightly (`scale(1.01)`)
    - Deepens shadow (`0 20px 40px rgba(0,0,0,0.6)`)
    - Subtle amber rim light appears.

### The Glass Surface (`.neo-dia-glass`)
Used for floating panels, sidebars, or modal backgrounds.
- **Backdrop**: `blur(16px) saturate(180%)`
- **Background**: `rgba(20, 20, 20, 0.4)`

### Aurora Orb (`.neo-dia-aurora-orb`)
Ambient background elements.
- **Animation**: `aurora-pulse` (12s cycle of opacity, scale, and translation).
- **Blur**: `100px`

---

## 4. Layout & Grid

- **Spacing**: Multiples of `4px` (Rem-based).
- **Container**: Fluid, max-width constraints only on readable content.
- **Z-Index Strategy**:
    - `0`: Background / Aurora
    - `1`: Grid Pattern / Noise
    - `10`: Content / Cards
    - `50`: Sticky Headers / Glass Overlays
    - `100`: Modals / Command Palette

---

## 5. Planned Features (Next Level)

### Command Palette (⌘K)
- **Visuals**: Centered glass modal, heavy backdrop blur.
- **Function**: Global search, navigation, quick actions.

### Smart Grouping
- **Visuals**: Stacks of cards with perspective offset.
- **Function**: Drag-and-drop auto-grouping based on context.

### AI Summary
- **Visuals**: Popover tooltip with "shimmer" border.
- **Function**: Summarize page/flow content on hover.
