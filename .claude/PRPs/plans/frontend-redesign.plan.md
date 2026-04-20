# Plan: Jeffrey.AI Frontend Redesign - Remaining Stories

## Summary
Implement Dark Academia Premium design system across remaining business pages (Members, Graph, Suggestions), create MiniMax TTS service, add TTS UI integration, create Jeffrey mascot SVG component, and sync mascot animation with TTS.

## User Story
As a user, I want a cohesive, premium Dark Academia visual experience across all pages with voice output so that Jeffrey.AI feels like a refined, memorable product.

## Metadata
- **Complexity**: Large (10+ files, multiple subsystems)
- **Source PRD**: `.claude/PRPs/prds/prd.json`
- **Estimated Files**: ~15 files

---

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | `src/lib/design-tokens.ts` | All design tokens defined here |
| P0 | `src/components/ui/index.ts` | Shared UI component exports |
| P1 | `src/app/members/page.tsx` | Members page to redesign |
| P1 | `src/app/graph/page.tsx` | Graph page to redesign |
| P1 | `src/app/suggestions/page.tsx` | Suggestions page to redesign |
| P1 | `src/components/ui/Card.tsx` | Shared Card component |
| P2 | `src/lib/jeffrey-quotes.ts` | Jeffrey voice/copy source |

---

## Patterns to Mirror

### DESIGN_TOKENS_USAGE
// SOURCE: `src/lib/design-tokens.ts:18-119`
All colors reference `C.bg`, `C.bgCard`, `C.bgHover`, `C.text`, `C.textSecondary`, `C.textMuted`, `C.primary`, `C.primaryHover`, `C.accent`, `C.border`, `C.borderStrong`, `C.borderAccent`
```ts
import { tokens as C } from "@/lib/design-tokens";
style={{ backgroundColor: C.bgCard, color: C.text, border: `1px solid ${C.border}` }}
```

### CARD_COMPONENT
// SOURCE: `src/components/ui/Card.tsx`
Use `Card` from `@/components/ui` instead of inline divs.
```tsx
import { Card } from "@/components/ui";
<Card style={{ padding: "16px 20px", marginBottom: 16 }}>
```

### BUTTON_COMPONENT
// SOURCE: `src/components/ui/Button.tsx`
Use `Button` from `@/components/ui` for primary actions.
```tsx
import { Button } from "@/components/ui";
<Button variant="primary" size="md">Label</Button>
```

### INPUT_COMPONENT
// SOURCE: `src/components/ui/Input.tsx`
Use `Input` from `@/components/ui` for form fields.
```tsx
import { Input } from "@/components/ui";
<Input placeholder="placeholder" value={value} onChange={e => setValue(e.target.value)} />
```

### DARK_THEME_OVERRides
// SOURCE: `src/app/members/page.tsx:189-190`
Members page uses `C.bg` for root background, NOT `C.surface` or hardcoded white.
```tsx
<div style={{ backgroundColor: C.bg, minHeight: "100vh" }}>
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/app/members/page.tsx` | UPDATE | Apply dark theme, use shared UI components |
| `src/app/graph/page.tsx` | UPDATE | Apply dark theme, update node/edge colors |
| `src/app/suggestions/page.tsx` | UPDATE | Apply dark theme, use dark card backgrounds |
| `src/services/tts.ts` | CREATE | MiniMax TTS HTTP client |
| `src/components/JeffreyMascot.tsx` | CREATE | SVG mascot with states |
| `src/app/input/page.tsx` | UPDATE | Add TTS play button + mascot |
| `src/app/suggestions/page.tsx` | UPDATE | Add TTS play button + mascot |
| `src/app/layout.tsx` | UPDATE | Add TTS context provider |

## NOT Building
- Auth pages redesign (already done in US-002)
- Landing page redesign (already done)
- Header redesign (already done in US-001)
- PersonModal redesign
- Mobile responsiveness

---

## Step-by-Step Tasks

### Task 1: Members Page Dark Theme Redesign
- **ACTION**: Rewrite members/page.tsx to use dark theme
- **IMPLEMENT**:
  - Root div: `backgroundColor: C.bg`
  - Table header: `backgroundColor: C.bgHover` (NOT `C.surfaceAlt`)
  - Table rows: alternating `C.bgCard` and `C.bgElevated` (NOT white/transparent)
  - Row hover: `C.bgHover`
  - Selected row: `C.bgActive` with accent border
  - Checkboxes: use `accentColor: C.accent`
  - Replace custom Input with `Input` component from `@/components/ui`
  - Replace custom inline buttons with `Button` component
  - Filter bar Card: dark background
  - Score color bar: uses `C.success`, `C.warning`, `C.error` semantic tokens
  - actionItems badge: dark theme (NOT white/light backgrounds)
- **MIRROR**: DESIGN_TOKENS_USAGE, CARD_COMPONENT
- **VALIDATE**: `npm run build` passes, page visually dark

### Task 2: Graph Page Dark Theme Redesign
- **ACTION**: Rewrite graph/page.tsx to use dark theme
- **IMPLEMENT**:
  - Root: `backgroundColor: C.bg`
  - Filter bar: dark `C.bgCard` background
  - Legend card: dark `C.bgCard`
  - Update LINK_COLORS to use bronze/ivory palette instead of bright blues/greens
  - Update NODE_COLORS to use warm tones
  - Sigma label color: `C.text` (ivory), not `#374151` (dark gray)
  - Loading overlay: dark semi-transparent
  - Use Card component for filter bar
- **MIRROR**: DESIGN_TOKENS_USAGE, CARD_COMPONENT
- **VALIDATE**: `npm run build` passes, graph renders in dark theme

### Task 3: Suggestions Page Dark Theme Redesign
- **ACTION**: Rewrite suggestions/page.tsx to use dark theme
- **IMPLEMENT**:
  - Root: `backgroundColor: C.bg`
  - Quote text: use `C.text` on dark
  - Cards: dark `C.bgCard` background
  - Stale contact cards: dark backgrounds instead of `C.surfaceAlt`
  - actionItems badge: dark theme
  - Select dropdown: dark theme with `C.bgCard` background
  - Style buttons: use dark theme with `C.bgCard`/`C.bgHover` instead of white
  - Batch generate box: dark theme
  - Icebreaker result: dark card instead of `#fffcf7`
  - Use `Tag` component for topic tags
  - Use `Card` component
- **MIRROR**: DESIGN_TOKENS_USAGE, CARD_COMPONENT
- **VALIDATE**: `npm run build` passes, page visually dark

### Task 4: MiniMax TTS Service
- **ACTION**: Create `src/services/tts.ts`
- **IMPLEMENT**:
  ```ts
  const TTS_API_KEY = process.env.MINIMAX_API_KEY;
  const TTS_ENDPOINT = "https://api.minimaxi.com/v1/t2a_v2";
  const VOICE_ID = "male-qn-qingse";
  const MODEL = "speech-2.8-hd";

  export async function playText(text: string): Promise<void> {
    const res = await fetch(TTS_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TTS_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        text,
        voice_setting: { voice_id: VOICE_ID, speed: 1, vol: 1, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 }
      })
    });
    if (!res.ok) throw new Error(`TTS error: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  }
  ```
- **GOTCHA**: Must use environment variable MINIMAX_API_KEY
- **VALIDATE**: TypeScript compiles, function is callable

### Task 5: TTS UI on Input Page
- **ACTION**: Add play button next to Jeffrey's text output on Input page
- **IMPLEMENT**:
  - Import `playText` from `@/services/tts`
  - Add state `const [isSpeaking, setIsSpeaking] = useState(false)`
  - Add play button (speaker icon) next to Jeffrey's response text
  - On click: `setIsSpeaking(true); await playText(text); setIsSpeaking(false)`
  - Button: use `Button` component with speaker icon, `variant="ghost"` style
- **VALIDATE**: TypeScript compiles, button renders

### Task 6: TTS UI on Suggestions Page
- **ACTION**: Add play button next to Jeffrey quote and icebreaker comment
- **IMPLEMENT**:
  - Import `playText` from `@/services/tts`
  - Add play button next to quote text
  - Add play button next to `jeffreyComment` in icebreaker result
  - Show subtle speaker icon, animate when speaking
- **VALIDATE**: TypeScript compiles

### Task 7: Jeffrey Mascot SVG Component
- **ACTION**: Create `src/components/JeffreyMascot.tsx`
- **IMPLEMENT**:
  - Vault-style chin silhouette, antique bronze color `#c9956a`
  - SVG path for chin profile
  - Props: `size?: number`, `state?: "idle" | "speaking" | "thinking" | "smiling" | "warning"`
  - CSS animations via `className`:
    - idle: subtle breathing `scale(0.98-1.02)` via keyframes
    - speaking: mouth open/close animation
    - thinking: gentle nod animation
    - smiling: subtle scale up
    - warning: subtle shake
  - Export as React component
  - Sizes: 40px (header), 80px (input), 200px (landing)
- **VALIDATE**: TypeScript compiles, SVG renders in browser

### Task 8: Mascot TTS Sync Animation
- **ACTION**: Connect mascot states to TTS playback
- **IMPLEMENT**:
  - Import JeffreyMascot into Input and Suggestions pages
  - When TTS starts: `mascotState="speaking"`
  - When TTS ends: `mascotState="idle"`
  - Display mascot (80px) next to Jeffrey's text output
- **VALIDATE**: Mascot animates during TTS playback

---

## Validation Commands

### Static Analysis
```bash
cd d:/Epstein.AI && npx tsc --noEmit
```
EXPECT: Zero TypeScript errors

### Build Check
```bash
cd d:/Epstein.AI && npm run build
```
EXPECT: Build succeeds with zero errors

### Browser Validation
```bash
npm run dev
# Navigate to http://localhost:30081/members, /graph, /suggestions
# Verify dark theme applied, no white/light backgrounds
# Test TTS play buttons
# Verify mascot animations
```

---

## Acceptance Criteria
- [ ] Members page uses dark theme (≥90% design tokens)
- [ ] Graph page uses dark theme (≥90% design tokens)
- [ ] Suggestions page uses dark theme (≥90% design tokens)
- [ ] TTS service created and callable
- [ ] TTS play button on Input page
- [ ] TTS play button on Suggestions page
- [ ] JeffreyMascot component created with all 5 states
- [ ] Mascot syncs with TTS playback
- [ ] `npm run build` passes with zero errors
- [ ] Visually verified in browser
