# Saksesories PH

ClearChain — a leather keychain with a microfiber pad that cleans eyeglasses and
screens. This repo is the marketing site, the staff point of sale, the marketing
portal, and the production inventory in one app.

**Tagline:** Sakses anytime, Style anytime — only here at Saksesories PH.

## Stack

| | |
|---|---|
| Build | Vite 8 |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS v4 (`@theme` tokens in `src/index.css`) |
| Routing | react-router-dom 7 |
| Data | Supabase (`@supabase/supabase-js`) — not wired yet |

## Run it

```powershell
npm install     # already done once
npm run dev     # http://localhost:5173
```

```powershell
npm run build   # type-check + production build into dist/
npm run preview # serve the built output
```

## Routes

Roles, rules and the full flow live in **[BLUEPRINT.md](./BLUEPRINT.md)**.

| Path | Screen | Who |
|---|---|---|
| `/` | Marketing homepage | Public |
| `/login` | Staff sign in | Public |
| `/pos` | Point of sale — build an order, take payment | Any signed-in account |
| `/portal` | My sales — orders, quota, departments | Any signed-in account |
| `/inventory` | Materials, stock value, cost to make one piece | Any signed-in account |
| `/finance` | Revenue, cost, margin, cash check | Finance, GM |
| `/quota` | Set the month — department quotas | GM |
| `/users` | Accounts and roles | GM |

Every page shares the top navbar from `components/SiteHeader.tsx`, which shows
only the links the signed-in role may open. `/inventory` keeps its own rail
inside the page because it belongs to production, not the sales floor.

Sign-in is mock: pick an account, the id is remembered in `localStorage`. No
password is checked and nothing is sent. `src/lib/auth.tsx` is the only file
that changes when real auth arrives.

## Brand

```
wine      #4a111a
blush     #f9eff1
crimson   #890e13
```

Type: **Playfair Display** for words, **Inter** for numbers and UI.

> Playfair has no `₱` glyph. Any peso amount inside a serif heading must be
> wrapped in `font-sans`, or it falls back to a different face.

## Money

Everything is stored in **centavos** (integers) so arithmetic never drifts.
`peso()` in `src/lib/data.ts` formats for display.

Engraving: 2 letters free, ₱2 per extra letter, 6 letters maximum.

## What is real vs mock

| Real | Mock (until Supabase is connected) |
|---|---|
| Cart maths, engraving fees, change due | Variant stock counts |
| Date-range filtering in the portal | The 16 sample sales |
| Material detail panel, cost breakdown | Material quantities |
| Routing, layout, responsive behaviour | Staff identity ("Ana Reyes") |
| Quota maths — cap, percentages, who-needs-it-most | The member roster and each member's `rungUp` / `credited` |

`src/lib/supabase.ts` exports a **nullable** client, so the app runs on mock data
with no credentials. Fill in `.env` (see `.env.example`) to switch it on.

## Layout

```
src/
├── index.css          design tokens + type rules
├── lib/
│   ├── data.ts        shapes, colours, variants, money helpers
│   ├── materials.ts   materials + cost breakdown
│   ├── quota.ts       monthly quota, roster, team total
│   └── supabase.ts    client + row types
├── components/
│   ├── Chain.tsx      the SVG keychain (heart / teardrop)
│   ├── SiteHeader.tsx top navbar + staff chip
│   └── SiteFooter.tsx
└── pages/
    ├── Home.tsx
    ├── Pos.tsx
    ├── Portal.tsx
    └── Inventory.tsx
```

`_mockup/` holds the earlier static HTML version — reference only, not built.
`_source/` holds the original logo and campaign photos.
