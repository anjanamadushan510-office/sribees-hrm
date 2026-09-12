# Color Theme & Styling Policy

## Color Palette & Tailwind Usage Rules
- **Always Use Defined Tailwind Colors**: When styling components, pages, or layouts, ALWAYS use color variables and utility classes defined in `tailwind.config.js` (e.g., `bg-canvas`, `bg-sidebar`, `bg-navbar`, `bg-brand-600`, `text-ink`, `border-line`, etc.).
- **No Arbitrary / Hardcoded Hex Colors**: Do NOT hardcode raw hex values (e.g., `#123456` or `bg-[#123456]`) directly in JSX components or inline styles.
- **Adding New Colors**: If a new color is required for the application, ALWAYS define it first in `tailwind.config.js` under `theme.extend.colors` before using it in any components or CSS files.
