/**
 * Jeffrey.AI — Design System
 *
 * Light Theme: Warm Minimal
 * "Clean intelligence, warm humanity"
 *
 * Key characteristics:
 * - Warm off-white backgrounds (not clinical white)
 * - Dark charcoal text (readable, not harsh)
 * - Warm amber as primary accent
 * - Emerald green for success states
 * - Soft, layered shadows on light surfaces
 */

export const tokens = {
  // ── Backgrounds ──────────────────────────────────────────────
  bg: "#f8f9fb",                   // Warm off-white base
  bgElevated: "#ffffff",           // Pure white cards
  bgCard: "#ffffff",              // Card surface
  bgHover: "#f0f2f5",             // Hover state
  bgActive: "#e8eaef",            // Active/selected

  // ── Text ───────────────────────────────────────────────────
  text: "#1a1a2e",                // Dark charcoal (readable)
  textSecondary: "#5c6080",        // Muted slate
  textMuted: "#9098b0",           // Subtle text
  textInverse: "#ffffff",         // Text on dark surfaces

  // ── Brand Colors ─────────────────────────────────────────────
  primary: "#f59e0b",            // Warm amber
  primaryHover: "#fbbf24",        // Bright amber
  primaryDeep: "#d97706",         // Deep amber
  accent: "#059669",              // Emerald green
  accentLight: "rgba(5, 150, 105, 0.08)",  // Accent wash

  // ── Borders ─────────────────────────────────────────────────
  border: "#e2e5ef",              // Light border
  borderStrong: "#cdd2e1",        // Stronger border
  borderAccent: "rgba(245, 158, 11, 0.4)",  // Accent border

  // ── Semantic ────────────────────────────────────────────────
  error: "#dc2626",               // Clear red
  errorBg: "#fef2f2",
  success: "#059669",              // Emerald green
  successBg: "#ecfdf5",
  warning: "#d97706",             // Amber warning
  warningBg: "#fffbeb",
  info: "#2563eb",                // Clear blue
  infoBg: "#eff6ff",

  // ── Graph Visualization Colors (Sigma.js) ───────────────────
  graph: {
    linkInteraction: '#3b82f6',
    linkIntroducedBy: '#f59e0b',
    linkSharedCareer: '#10b981',
    linkSharedCity: '#8b5cf6',
    linkSharedInterest: '#f97316',
    linkSharedPlace: '#ec4899',
    linkSharedVibe: '#6366f1',
    clusterCity: '#3b82f6',
    clusterCareer: '#10b981',
    clusterInterest: '#f59e0b',
    clusterPlace: '#ec4899',
    clusterVibe: '#8b5cf6',
    nodeDefault: '#3b82f6',
    careerBanker: '#10b981',
    careerLawyer: '#f59e0b',
    careerDoctor: '#ef4444',
    careerProfessor: '#8b5cf6',
    careerFounder: '#f97316',
    careerAI: '#6366f1',
  },

  // ── Semantic Color Overrides for Ambiguous/Merge UI ───────────
  prompt: {
    bg: "#fffbf0",
    bgLight: "#fef9ec",
    border: "#f0d78c",
    borderLight: "#f59e0b",
    text: "#1a1a2e",
    textMuted: "#7a6a5a",
    accent: "#d97706",
    tagCareerBg: "#dbeafe",
    tagCareerText: "#1e40af",
    tagInterestBg: "#fef3c7",
    tagInterestText: "#92400e",
    tagVibeBg: "#e0e7ff",
    tagVibeText: "#3730a3",
    survivorBorder: "#f59e0b",
    victimBg: "#faf8f4",
  },

  // ── Shadows ─────────────────────────────────────────────────
  shadowSm: "0 1px 2px rgba(0,0,0,0.06)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.1)",
  shadowGlow: "0 0 20px rgba(245, 158, 11, 0.15)",

  // ── Spacing ─────────────────────────────────────────────────
  space1: "4px",
  space2: "8px",
  space3: "12px",
  space4: "16px",
  space5: "20px",
  space6: "24px",
  space8: "32px",
  space10: "40px",
  space12: "48px",
  space16: "64px",

  // ── Border Radius ────────────────────────────────────────────
  radiusSm: "4px",
  radiusMd: "8px",
  radiusLg: "12px",
  radiusXl: "16px",
  radiusFull: "9999px",

  // ── Typography ────────────────────────────────────────────────
  fontDisplay: "'Cormorant Garamond', 'Georgia', serif",
  fontBody: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  fontMono: "'JetBrains Mono', 'Fira Code', monospace",

  // Font sizes
  textXs: "11px",
  textSm: "13px",
  textBase: "15px",
  textLg: "17px",
  textXl: "20px",
  text2xl: "24px",
  text3xl: "30px",
  text4xl: "36px",
  text5xl: "48px",

  // Line heights
  leadingTight: "1.2",
  leadingNormal: "1.5",
  leadingRelaxed: "1.7",

  // ── Transitions ─────────────────────────────────────────────
  transitionFast: "0.1s ease",
  transitionBase: "0.15s ease",
  transitionSlow: "0.3s ease",
  transitionSpring: "0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",

  // ── Layout ─────────────────────────────────────────────────
  maxWidth: "1400px",
  headerHeight: "60px",
  sidebarWidth: "280px",
} as const;

export type DesignTokens = typeof tokens;

/* ── Semantic aliases for backward compatibility ── */
export const C = tokens;
