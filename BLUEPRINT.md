# Saksesories PH — blueprint

The shape of the app before any of it is wired to a database. Routes, roles,
and the rules that decide who may do what.

---

## Roles

Five kinds of visitor. One of them is not an account at all.

| Role | Account? | Quota | Owns |
|---|---|---|---|
| Customer | No | — | Their order |
| Marketing | Yes | Yes | Selling |
| Production | Yes | Yes | Making, and stock |
| Finance | Yes | Yes | Money |
| GM | Yes | Yes | Targets and accounts |

**Everyone with an account sells, and everyone with an account carries a quota.**
The 650 is split across all 17 accounts — not just the sales floor.

---

## Routes

| Path | Page | Who gets in |
|---|---|---|
| `/` | Shop | Anyone |
| `/login` | Sign in | Anyone |
| `/pos` | Point of sale | Any signed-in account |
| `/portal` | My sales | Any signed-in account |
| `/inventory` | Inventory | Any signed-in account |
| `/finance` | Finance | Finance, GM |
| `/quota` | Set the month | GM |
| `/users` | Accounts | GM |

Hiding a link is a courtesy; every route is also guarded. Typing `/quota` as
Marketing lands on **Restricted**, which names the role that owns the screen
instead of silently bouncing you to the homepage.

---

## The life of one piece

```
1. Batch        Production records "we made 20 heart/maroon"
2. Stock +      Variant stock rises by 20, materials fall
3. POS sale     A customer pays
4. Stock −1     The variant falls by one
   Quota +1     One piece is credited to somebody
```

Stock is **derived**, never typed. Nobody edits "9 left" by hand — it is what
production made, minus what was sold.

---

## The two gates

A sale only records if **both** pass:

| Gate | Fails when | Whose problem |
|---|---|---|
| Stock | The variant is at 0 | Production — make more |
| Quota | Every account is at its cap | Nobody's — the month is done |

They fail for different reasons and must be reported differently. One combined
"Cannot sell" message turns a stock shortage into an argument between
departments.

---

## Quota rules

**1. A quota is a ceiling.** Nobody may sell past their own number. This is the
opposite of normal sales practice, and it is deliberate: 650 is also what
production can make, so the selling cap mirrors the stock cap.

**2. One sale, one credit.** The sale is recorded against whoever was logged in.
It is never split between two people — split it and 650 becomes 1300.

**3. When you are full, the credit moves.** The sale still happens; the piece
counts against a teammate who still has room. Two separate numbers are kept:

- `rungUp` — who stood at the POS. Never changes.
- `credited` — whose quota it counts against. Moves on transfer.

Keep both. If only `credited` survived, the person who actually sold the piece
would vanish from the record and someone else would collect the number.

**4. "Needs it most" means furthest behind, in percent.** Not the lowest raw
count. Quotas differ by department — 50 in Marketing, 31–34 elsewhere — so
11/31 is further behind than 30/50 even though 11 is the smaller number.

**5. Whole pieces only.** 250 ÷ 8 is 31.25, and a quarter of a keychain cannot
be sold. Per-member shares are derived with `splitEven`, which gives the
remainder to the first few and always adds back up:

```
300 ÷ 6  →  50 · 50 · 50 · 50 · 50 · 50
250 ÷ 8  →  32 · 32 · 31 · 31 · 31 · 31 · 31 · 31
100 ÷ 3  →  34 · 33 · 33
```

**6. The GM types department totals, never per-member numbers.** One rule
applies to everyone including the GM: the departments must add up to the team
total. The quota screen refuses to save otherwise.

---

## Where the lines are drawn

| Rule | Why |
|---|---|
| Marketing cannot edit stock | Production makes the pieces; Marketing only needs to know what is sellable |
| Marketing cannot see cost or margin | Selling needs a price, not the cost sheet |
| Marketing sees the team leaderboard but not other people's orders | It needs to know who has room; it does not need customer names and numbers |
| Finance cannot edit stock or catalogue | Counting money and changing inventory are different jobs |
| Only the GM sets quotas and roles | One person owns the target, or nobody does |
| Accounts are deactivated, never deleted | Deleting a person erases their sales and rewrites history |

With seventeen people who all sell, clean separation of duties is impossible.
The controls that survive are the cheap ones: a void needs a reason and leaves
the record in place, and every number is visible to more than one person.

---

## Built

- Sign-in with a session, role-aware navigation, guarded routes
- Shop, POS, My sales, Inventory
- Finance — revenue, cost, margin, cash check
- Set the month — department quotas, live whole-piece split, sum check
- Accounts — the roster with each person's quota

## Draft

Every figure comes from `src/lib/*.ts`, not from a database. Nothing is saved:
a completed sale does not move stock or quota, and the quota screen cannot
store a month.

## Next

1. Data layer — so a sale actually moves stock and quota
2. Void with a reason, restoring both
3. Production batch entry
4. Inventory hiding cost from Marketing
