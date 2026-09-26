# Honey Chain — Blockchain-Based Honey Traceability (v1)

Prototype digital ecosystem for **KVIC's Honey Mission**: honey batches sealed on a tamper-evident ledger, verifiable by any customer with one QR scan.

## What is built (full prototype)

All four modules are implemented. The headline flow:

> **Customer scans a jar QR → public verification page proves the batch is authentic and untampered.**

| Module | Where | Highlights |
| --- | --- | --- |
| 1 · Honey Traceability | `/batches`, `/generate-qr`, `/verify/{id}` | Batch creation → ledger seal → QR → public verify |
| 2 · Smart Beekeeping | `/dashboard`, `/hives`, `/hives/{id}` | Live IoT readings (5 s cadence), hive details, per-metric charts |
| 3 · AI Smart Analytics | Dashboard + hive detail panels | Health status, disease-risk %, yield prediction, environmental risk, recommended action — labeled "AI Prototype Analysis" |
| 4 · Market Linkage | `/marketplace` | Verified-batch listings linking to traceability |
| 6 · Blockchain Traceability | `/blockchain` | Visual per-batch block timeline with tx/prev/content hashes — labeled "Prototype Blockchain Record" |
| 8 · Alert System | Dashboard alerts card | High temp / high humidity / weight drop / abnormal sound / disease risk, with Warning vs Critical severity |
| 9 · Analytics | Dashboard + hive details | Temperature/humidity/weight/sound time series, health donut, predicted-vs-actual bars |
| 10 · User Roles | In-app | Beekeeper (manage), Processor/Admin (`recordStage` mutations on `/batches`), Consumer (public `/verify`) |

### The v1 flow, end to end

```
Beekeeper registers hive → simulated IoT sensors stream (24h) → AI classifies
colony health + predicts yield → batch created → batch metadata hashed onto
the hash-chained ledger → QR generated → customer scans → server recomputes
hashes → "Blockchain Verified ✓"
```

Demo data (3 hives, 39 sensor readings, 3 AI predictions, 1 verified batch) **auto-seeds on first visit** to `/`, or run manually:

```bash
bun convex run demo:seedDemoData '{}'
```

Key routes:

| Route | Purpose |
| --- | --- |
| `/` | Scan-a-QR box (home screen) + live demo batch shortcuts |
| `/verify/{batch_id}` | **Public** verification page — no login required |
| `/generate-qr` | Jar label QR generator (encodes the verify URL, downloadable PNG) |
| `/marketplace` | Verified-batch marketplace (Module 4) |
| `/dashboard` | Beekeeper portal: totals, quick actions, live hives, AI panels, analytics charts, alerts, recent batches (protected) |
| `/hives` | Hive management list (Module 2) |
| `/hives/{hive_id}` | Hive details: sensor time-series charts + AI Smart Analytics |
| `/batches` | Batch management: create, processor stage recording, traceability timeline, QR + blockchain links |
| `/blockchain` | Per-batch visual block timeline (Module 6) |

## Blockchain design: hash-chain simulation (explicit)

⚠️ **This is a blockchain-principles simulation, NOT a live blockchain.** There is no consensus network, no tokens, no smart contracts. It is an **append-only, hash-chained ledger** (`ledger` table, logic in `src/convex/ledger.ts`):

- `content_hash` = SHA-256 of the canonical (sorted-key) JSON of the batch payload.
- `tx_hash` = SHA-256 of the block envelope (payload + `content_hash` + `prev_hash` + `block_number`), so each block cryptographically commits to the previous one.
- Block 0 links to a genesis hash of 64 zeros.
- **Blockchain design rule honored:** only batch ID, hive ID, beekeeper ID, harvest/processing/packaging metadata, and content hashes go on the ledger. Raw sensor data lives only in the `sensor_data` table and is never hashed on-chain.

### What the verify page proves

For every scan of `/verify/{batch_id}`, the server **independently recomputes** (`verifyBatchIntegrity` in `src/convex/ledger.ts`):

1. `hash_match` — does SHA-256(stored payload) equal the sealed `content_hash`? If not, batch fields were edited after sealing.
2. `prev_hash_valid` — does this block link to its real predecessor? Detects chain splices.
3. `tx_hash_valid` — is the block envelope reproducible? Detects envelope tampering.

All three pass ⇒ **"Blockchain Verified ✓"**. Any failure names the specific anomaly.

### What is simulated vs. real

| Layer | Status | Production replacement |
| --- | --- | --- |
| Ledger | **Simulated** — hash-chained DB table | Swap `appendBatchBlock` in `src/convex/ledger.ts` for a web3.py/ethers.js tx to a permissioned chain (Hyperledger Besu) or public L2. `BatchMetadataPayload` maps 1:1 to a Solidity struct; keep the hashing scheme byte-identical so batch IDs stay verifiable. |
| IoT sensors | **Simulated** — seeded 24h stream, realistic per-hive profiles (brood temp 33–36 °C, humidity bands, weight gains, sound) | Replace `simulateReading` in `src/convex/demo.ts` with HTTP POSTs from real ESP32 nodes. The schema (`sensor_data` table) and consumers are ingestion-agnostic. Production would add per-device auth keys. |
| AI/ML | **Simulated but explainable** — `classifyHealth` (Healthy / Warning / Disease Risk + recommended action) and `predictYield7d` in `src/convex/demo.ts` are transparent threshold/linear rules matching what a scikit-learn model trained on the same synthetic generator would learn. Synthetic-data generation logic is documented in that file's header. | Train real models offline (pandas + scikit-learn) on accumulated `sensor_data` + inspection labels; deploy as a Convex action calling a model endpoint. |
| QR codes | **Real** — generated client-side with the `qrcode` library, encoding `${origin}/verify/{batch_id}` | In production, printed on jar labels at packaging time. |
| Auth | **Real** — Convex Auth (email OTP) protects the beekeeper portal | Multi-tenant scoping by beekeeper/KVIC cluster is marked in code. |

### Database (Convex tables, `src/convex/schema.ts`)

`hives`, `sensor_data` (off-chain time-series), `ledger` (hash chain), `honey_batches`, `alerts`, `ai_predictions` — mirroring the brief's Postgres schema. Scaling swap points are marked with `SCALING:` comments in the source.

### API (Convex functions, `src/convex/traceability.ts`)

| Function | Type | Maps to brief's REST endpoint |
| --- | --- | --- |
| `traceability.createBatch` | mutation | `POST /batches` |
| `traceability.getBatchForVerification` | query (public) | `GET /verify/{batch_id}` |
| `traceability.getBatchPayload` | query | ledger payload lookup |
| `traceability.listBatchIds` | query | marketplace/demo listing |
| `apiary.getDashboard` | query | `GET /hives/{id}` (aggregate) |
| `apiary.getHiveDetails` | query | `GET /hives/{id}` (readings + AI) |
| `apiary.getAnalytics` | query | analytics series + health/production charts |
| `apiary.createHive` | mutation | `POST /hives` |
| `apiary.updateHive` | mutation | `PATCH /hives/{id}` (location / colony strength / status) |
| `apiary.deleteHive` | mutation | `DELETE /hives/{id}` (cascades sensor/AI/alert history; ledger-sealed batches kept for traceability) |
| `apiary.getHiveAssociations` | query | associated-data preview for the delete confirmation |
| `apiary.getHiveAlertHistory` | query | `GET /hives/{id}/alerts` (full history incl. resolved) |
| `apiary.resolveAlert` | mutation | `POST /alerts/{id}/resolve` (keeps row with `resolved_at`) |
| `traceability.updateBatch` | mutation | `PATCH /batches/{id}` (edit BEFORE finalization; seals a `batch_amended` ledger block — never rewrites sealed data) |
| `apiary.pushSimulatedReading` | mutation | `POST /sensor-data` (ingestion + alert rules) |
| `apiary.getAlerts` | query | `GET /alerts` |
| `apiary.resetDemo` | mutation | demo reset (prototype only) |
| `traceability.recordStage` | mutation | processor/admin stage recording (→ new ledger block) |
| `traceability.getBatchTimeline` / `getBatchBlocks` | query | traceability + blockchain views |
| `traceability.listAllBatches` | query | batch management listing |
| `apiary.listVerifiedBatches` | query | marketplace listing |
| `demo.seedDemoData` | mutation | seed/demo script |
| `demo.classifyHealth` / `demo.predictYield7d` | exported rules | `GET /hives/{id}/prediction` (server logic) |

## Modules 2–4 (also implemented)

- **Smart Beekeeping (Module 2)** — `/dashboard` shows per-hive live readings (temp/humidity/weight/sound) with an **IoT live toggle** that pushes a new simulated reading every 5 s (`apiary.pushSimulatedReading`), re-runs the AI rules server-side, updates hive status, and raises alerts. Add Hive and Create Batch dialogs complete the flow.
- **AI Prediction (Module 3)** — `classifyHealth` / `predictYield7d` rules run on every simulated reading; the same signatures accept a trained scikit-learn model later.
- **Market Linkage (Module 4)** — `/marketplace` lists ledger-verified batches, each linking to its public verification page.

## Demo reset

```bash
bun convex run apiary:resetDemo '{}' && bun convex run demo:seedDemoData '{}'
```

Re-seeds **5 hives across 2 beekeeper profiles** (BK-001 Ramesh Patil ×3 hives, BK-002 Sunita Devi ×2 hives — one per AI outcome), 24 h of Demo IoT Data, AI analyses with disease-risk %, an alert history including a **resolved** entry, and **5 batches** (BK-001: 12.5 + 8.0 + 6.2 = 26.7 kg; BK-002: 15.0 + 4.5 = 19.5 kg) with full lifecycle timelines.

## Demo identity / multi-beekeeper login

The prototype has no real per-user KVIC auth yet (Convex Auth protects the portal session, not a beekeeper registry), so the dashboard uses a **demo login**: pick a beekeeper profile in the header switcher ("Demo beekeeper (no real auth)") and every query — welcome name, hive list, totals, honey-produced stat, batches — re-scopes to that profile instantly. The choice persists via `localStorage` (`honeychain.activeProfile`). SCALING swap point: replace `useDemoProfile` in `src/lib/dataLayer.ts` with an authenticated user → beekeeper lookup.

`total_produced_kg` sums **all** of the active beekeeper's batch quantities regardless of lifecycle status (a harvested-and-registered batch is produced), and every stat/list is a reactive Convex subscription, so add/edit/delete reflects everywhere without a refresh.

## Verification certificate export

The public `/verify/{batch_id}` page has **Share certificate** and **Download certificate (PNG)** buttons: the verification verdict card is rendered client-side to a 2× PNG via `@zumer/snapdom` (already a project dependency) and downloaded, or shared via the Web Share API on supporting devices.

## Multi-hive comparison + alert history

- `/hives` → **Compare hives** toggle: side-by-side table of every hive's status, temperature, humidity, weight, predicted 7-day yield and colony strength (Demo IoT Data · AI Prototype Analysis).
- `/hives/{id}` → **Alert history** log: active and resolved alerts with timestamps and a one-click **Resolve** action (`alerts.resolved_at`), so the system visibly tracks issues over time rather than showing only a live snapshot.

## Roadmap beyond the prototype

- Real chain adapter (permissioned network) + IoT device auth + KVIC multi-tenant clusters.
- Trained scikit-learn models replacing the explainable rules behind `classifyHealth` / `predictYield7d` (same signatures).
- Real processor/admin login roles via Convex Auth (role checks already isolated to mutation entry points).

---

## Overview

This project uses the following tech stack:
- Vite
- Typescript
- React Router v7 (all imports from `react-router` instead of `react-router-dom`)
- React 19 (for frontend components)
- Tailwind v4 (for styling)
- Shadcn UI (for UI components library)
- Lucide Icons (for icons)
- Convex (for backend & database)
- Convex Auth (for authentication)
- Framer Motion (for animations)
- Three js (for 3d models)

All relevant files live in the 'src' directory.

Use bun for the package manager.

## Setup

This project is set up already and running on a cloud environment, as well as a convex development in the sandbox.

## Environment Variables

The project is set up with project specific CONVEX_DEPLOYMENT and VITE_CONVEX_URL environment variables on the client side.

The convex server has a separate set of environment variables that are accessible by the convex backend.

Currently, these variables include auth-specific keys: JWKS, JWT_PRIVATE_KEY, and SITE_URL.


# Using Authentication (Important!)

You must follow these conventions when using authentication.

## Auth is already set up.

All convex authentication functions are already set up. The auth currently uses email OTP and anonymous users, but can support more.

The email OTP configuration is defined in `src/convex/auth/emailOtp.ts`. DO NOT MODIFY THIS FILE.

Also, DO NOT MODIFY THESE AUTH FILES: `src/convex/auth.config.ts` and `src/convex/auth.ts`.

## Using Convex Auth on the backend

On the `src/convex/users.ts` file, you can use the `getCurrentUser` function to get the current user's data.

## Using Convex Auth on the frontend

The `/auth` page is already set up to use auth. Navigate to `/auth` for all log in / sign up sequences.

You MUST use this hook to get user data. Never do this yourself without the hook:
```typescript
import { useAuth } from "@/hooks/use-auth";

const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
```

## Protected Routes

The starter `/dashboard` route is protected with `RequireAuth`. Extend that page
for the product's authenticated experience, and reuse `RequireAuth` when adding
another protected route — do NOT hand-roll a redirect to `/auth`, since landing
on a bare sign-in form with no explanation of what was blocked is confusing.

`RequireAuth` states the block on the page the visitor asked for and sends them
to `/auth?returnTo=<current route>` when they choose to sign in, so they come
back to it. Pass `title` and `description` to say what the page is:

```tsx
<Route
  path="/dashboard"
  element={
    <RequireAuth
      title="Sign in to view your dashboard"
      description="Your projects and settings live here."
    >
      <Dashboard />
    </RequireAuth>
  }
/>
```

Pass `redirectImmediately` for a route where bouncing straight to `/auth` really
is better.

## Auth Page

The auth page is defined in `src/pages/Auth.tsx`. Send sign-in and sign-up actions
to `/auth`.

## Authorization

You can perform authorization checks on the frontend and backend.

On the frontend, you can use the `useAuth` hook to get the current user's data and authentication state.

You should also be protecting queries, mutations, and actions at the base level, checking for authorization securely.

## Adding a redirect after auth

The `/auth` route in `src/main.tsx` redirects to `/dashboard` by default. If the
product's main authenticated route is different, update `redirectAfterAuth` to
that route. A validated same-origin `returnTo` query parameter takes priority so
users can resume the protected page they originally requested. Never leave an
authenticated product redirecting back to the public landing page.

## Complete authenticated products

When the requested product implies accounts, a workspace, a dashboard, or other
signed-in functionality, the task is not complete with only a landing page and
auth form. Build the main authenticated experience, protect its route, and verify
that signing in reaches it.

# Frontend Conventions

You will be using the Vite frontend with React 19, Tailwind v4, and Shadcn UI.

Generally, pages should be in the `src/pages` folder, and components should be in the `src/components` folder.

Shadcn primitives are located in the `src/components/ui` folder and should be used by default.

## Page routing

Your page component should go under the `src/pages` folder.

When adding a page, update the react router configuration in `src/main.tsx` to include the new route you just added.

## Shad CN conventions

Follow these conventions when using Shad CN components, which you should use by default.
- Remember to use "cursor-pointer" to make the element clickable
- For title text, use the "tracking-tight font-bold" class to make the text more readable
- Always make apps MOBILE RESPONSIVE. This is important
- AVOID NESTED CARDS. Try and not to nest cards, borders, components, etc. Nested cards add clutter and make the app look messy.
- AVOID SHADOWS. Avoid adding any shadows to components. stick with a thin border without the shadow.
- Avoid skeletons; instead, use the loader2 component to show a spinning loading state when loading data.


## Landing Pages

You must always create good-looking designer-level styles to your application. 
- Make it well animated and fit a certain "theme", ie neo brutalist, retro, neumorphism, glass morphism, etc

Use known images and emojis from online.

If the user is logged in already, show the get started button to say "Dashboard" or "Profile" instead to take them there.

## Responsiveness and formatting

Make sure pages are wrapped in a container to prevent the width stretching out on wide screens. Always make sure they are centered aligned and not off-center.

Always make sure that your designs are mobile responsive. Verify the formatting to ensure it has correct max and min widths as well as mobile responsiveness.

- Always create sidebars for protected dashboard pages and navigate between pages
- Always create navbars for landing pages
- On these bars, the created logo should be clickable and redirect to the index page

## Animating with Framer Motion

You must add animations to components using Framer Motion. It is already installed and configured in the project.

To use it, import the `motion` component from `framer-motion` and use it to wrap the component you want to animate.


### Other Items to animate
- Fade in and Fade Out
- Slide in and Slide Out animations
- Rendering animations
- Button clicks and UI elements

Animate for all components, including on landing page and app pages.

## Three JS Graphics

Your app comes with three js by default. You can use it to create 3D graphics for landing pages, games, etc.


## Colors

You can override colors in: `src/index.css`

This uses the oklch color format for tailwind v4.

Always use these color variable names.

Make sure all ui components are set up to be mobile responsive and compatible with both light and dark mode.

Set theme using `dark` or `light` variables at the parent className.

## Styling and Theming

When changing the theme, always change the underlying theme of the shad cn components app-wide under `src/components/ui` and the colors in the index.css file.

Avoid hardcoding in colors unless necessary for a use case, and properly implement themes through the underlying shad cn ui components.

When styling, ensure buttons and clickable items have pointer-click on them (don't by default).

Always follow a set theme style and ensure it is tuned to the user's liking.

## Toasts

You should always use toasts to display results to the user, such as confirmations, results, errors, etc.

Use the shad cn Sonner component as the toaster. For example:

```
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
export function SonnerDemo() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast("Event has been created", {
          description: "Sunday, December 03, 2023 at 9:00 AM",
          action: {
            label: "Undo",
            onClick: () => console.log("Undo"),
          },
        })
      }
    >
      Show Toast
    </Button>
  )
}
```

Remember to import { toast } from "sonner". Usage: `toast("Event has been created.")`

## Dialogs

Always ensure your larger dialogs have a scroll in its content to ensure that its content fits the screen size. Make sure that the content is not cut off from the screen.

Ideally, instead of using a new page, use a Dialog instead. 

# Using the Convex backend

You will be implementing the convex backend. Follow your knowledge of convex and the documentation to implement the backend.

## The Convex Schema

You must correctly follow the convex schema implementation.

The schema is defined in `src/convex/schema.ts`.

Do not include the `_id` and `_creationTime` fields in your queries (it is included by default for each table).
Do not index `_creationTime` as it is indexed for you. Never have duplicate indexes.


## Convex Actions: Using CRUD operations

When running anything that involves external connections, you must use a convex action with "use node" at the top of the file.

You cannot have queries or mutations in the same file as a "use node" action file. Thus, you must use pre-built queries and mutations in other files.

You can also use the pre-installed internal crud functions for the database:

```ts
// in convex/users.ts
import { crud } from "convex-helpers/server/crud";
import schema from "./schema.ts";

export const { create, read, update, destroy } = crud(schema, "users");

// in some file, in an action:
const user = await ctx.runQuery(internal.users.read, { id: userId });

await ctx.runMutation(internal.users.update, {
  id: userId,
  patch: {
    status: "inactive",
  },
});
```


## Common Convex Mistakes To Avoid

When using convex, make sure:
- Document IDs are referenced as `_id` field, not `id`.
- Document ID types are referenced as `Id<"TableName">`, not `string`.
- Document object types are referenced as `Doc<"TableName">`.
- Keep schemaValidation to false in the schema file.
- You must correctly type your code so that it passes the type checker.
- You must handle null / undefined cases of your convex queries for both frontend and backend, or else it will throw an error that your data could be null or undefined.
- Always use the `@/folder` path, with `@/convex/folder/file.ts` syntax for importing convex files.
- This includes importing generated files like `@/convex/_generated/server`, `@/convex/_generated/api`
- Remember to import functions like useQuery, useMutation, useAction, etc. from `convex/react`
- NEVER have return type validators.
