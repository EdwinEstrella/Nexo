# Design System: The Architectural Ledger

## 1. Overview & Creative North Star
**Creative North Star: "The Financial Sanctuary"**
In the complex, often chaotic world of mortgage lending, this design system acts as a stabilizing force. It moves beyond the "standard SaaS dashboard" by adopting an editorial, high-end architectural aesthetic. We reject the "boxed-in" feeling of traditional financial software. Instead, we embrace **The Financial Sanctuary**—a space defined by intentional breathing room, layered depth, and authoritative typography.

The system breaks the "template" look through:
*   **Intentional Asymmetry:** Data is balanced not by rigid grids, but by visual weight and "white space as a luxury."
*   **Tonal Authority:** We use a deep, monochromatic foundation of navy and slate to project an image of unshakeable institutional security.
*   **The "Human" Layer:** While the data is cold and hard, the interface is soft and responsive, utilizing glassmorphism and ambient shadows to feel modern and approachable.

---

## 2. Colors & Surface Architecture

### The Palette
We utilize a sophisticated spectrum of navy (`primary`) and professional greys (`secondary`), accented by a vibrant emerald (`tertiary`) to denote financial health.

*   **Primary (The Anchor):** `#000e24`. Used for high-level navigation and primary brand moments.
*   **Tertiary (The Success Metric):** `#002114` (On-Tertiary) & `#85f8c4` (Fixed). Use this sparingly to highlight positive equity, approved loans, or completed milestones.
*   **Surface Neutrals:** From `surface-container-lowest` (`#ffffff`) to `surface-dim` (`#cfdaf2`).

### The "No-Line" Rule
**Borders are a failure of hierarchy.** To maintain a premium editorial feel, designers are prohibited from using 1px solid borders to section off the UI. Boundaries must be defined through:
1.  **Background Shifts:** Place a `surface-container-lowest` card on a `surface-container-low` background.
2.  **Tonal Transitions:** Use subtle shifts in the blue-grey spectrum to indicate where one functional area ends and another begins.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine heavy-stock paper.
*   **Level 0 (Base):** `surface` (`#f9f9ff`)
*   **Level 1 (Sections):** `surface-container-low` (`#f0f3ff`)
*   **Level 2 (Active Cards):** `surface-container-lowest` (`#ffffff`)
*   **Level 3 (Pop-overs/Modals):** `surface-container-high` (`#dee8ff`)

### The "Glass & Gradient" Rule
To add "soul" to the data:
*   **CTAs:** Use a subtle linear gradient from `primary` (`#000e24`) to `primary-container` (`#00234b`) at a 135-degree angle.
*   **Overlays:** Use Glassmorphism (semi-transparent `surface_variant` with a 12px-20px backdrop-blur) for floating navigation bars or tooltips to ensure the layout feels integrated.

---

## 3. Typography
We use a dual-font strategy to balance institutional authority with modern readability.

*   **Display & Headlines (Manrope):** A geometric sans-serif that feels engineered and modern. Use `display-lg` (3.5rem) for big-picture metrics (e.g., Total Loan Value) to create an editorial focal point.
*   **Title & Body (Inter):** The workhorse. `title-md` (1.125rem) is our standard for card headers. `body-md` (0.875rem) is the default for data tables and descriptions.
*   **Hierarchy as Security:** Large, high-contrast headlines project confidence. Tight, well-spaced labels (`label-md`) ensure that even the most data-heavy mortgage amortization table feels legible and non-threatening.

---

## 4. Elevation & Depth

### The Layering Principle
Forget "Drop Shadow Level 1." Depth is achieved by "stacking" tonal tiers. A card is not a box with a shadow; it is a `surface-container-lowest` object sitting on a `surface-container-low` plane.

### Ambient Shadows
When a floating effect is required (e.g., a critical "Approve" button or a Modal):
*   **Blur:** 24px - 40px.
*   **Opacity:** 4%-6%.
*   **Color:** Use a tinted version of `on-surface` (`#111c2d`) rather than pure black. This mimics natural light passing through glass.

### The "Ghost Border" Fallback
If a border is required for accessibility (e.g., in high-contrast situations):
*   Use `outline-variant` (`#c4c6d0`) at **15% opacity**.
*   **Forbidden:** 100% opaque, high-contrast lines that "trap" the data.

---

## 5. Components

### Primary Buttons
*   **Visuals:** Gradient of `primary` to `primary-container`. 
*   **Rounding:** `md` (0.375rem) for a robust, "heavy" feel.
*   **State:** On hover, increase the gradient intensity and apply a `lg` ambient shadow.

### Data Cards (The Core Component)
*   **Rule:** No dividers. 
*   **Separation:** Use vertical white space (32px+) and `label-sm` headers in `secondary` color to group data.
*   **Background:** `surface-container-lowest`.

### Input Fields
*   **Style:** Minimalist. No bottom line, no full box. Use a `surface-container-high` background with a `sm` (0.125rem) radius. 
*   **Focus:** Transition background to `primary_fixed` with a subtle `primary` ghost border.

### Status Chips
*   **Positive (Approved):** `tertiary_fixed` background with `on_tertiary_fixed_variant` text.
*   **Pending:** `secondary_fixed` background with `on_secondary_fixed_variant` text.
*   **Rounding:** `full` (pill shape) to contrast against the more angular data cards.

### Mortgage Progress Tracker (Custom Component)
*   A thick, horizontal bar using `surface-container-highest`.
*   Filled portion uses a gradient from `tertiary` to `tertiary_fixed`.
*   Nodes are `surface-container-lowest` circles with a 4% ambient shadow.

---

## 6. Do's and Don'ts

### Do
*   **DO** use whitespace as a functional tool to separate loan sections.
*   **DO** use Manrope for all numbers/currency to give them a "designed" feel.
*   **DO** layer containers (`lowest` on `low`) to create natural hierarchy.
*   **DO** use "Emerald" (`tertiary`) only for finality and positive financial growth.

### Don't
*   **DON'T** use 1px solid borders to create grids.
*   **DON'T** use harsh black shadows.
*   **DON'T** use pure red for anything other than a critical system error (use `secondary` for "declined" states to maintain a professional, calm tone).
*   **DON'T** crowd the sidebar; keep navigation items spaced with `body-lg` sizing for an air of exclusivity.