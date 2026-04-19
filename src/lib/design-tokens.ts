"use client";

/**
 * Jeffrey.AI — Dark Academia Premium Design System
 *
 * Aesthetic: Deep walnut + antique bronze + aged paper
 * "A refined gentleman's study at midnight"
 *
 * Key characteristics:
 * - Deep, warm darks (not cold blacks)
 * - Antique bronze/copper as accent (not generic gold)
 * - Cream/ivory for text on dark (not stark white)
 * - Subtle texture via noise grain
 * - Restrained, purposeful animations
 * - Serif display font for gravitas
 */

export const tokens = {
  // ── Backgrounds ──────────────────────────────────────────────
  // ── Backgrounds ──────────────────────────────────────────────
  bg: "#141210",                  // Deep walnut black (warm, not cold)
  bgElevated: "#1c1917",          // Elevated surface
  bgCard: "#231f1b",              // Card/surface
  bgHover: "#2a2520",             // Hover state
  bgActive: "#332c26",            // Active/selected
  /* ── Backward-compat aliases ── */
  surface: "#f5f3ef",              // Light fallback (not used in dark theme but needed by some pages)
  surfaceAlt: "#faf8f4",           // Light alt surface

  // ── Text ───────────────────────────────────────────────────
  text: "#f5f0e8",                // Warm ivory (primary text)
  textSecondary: "#a8a29e",       // Muted stone
  textMuted: "#78716c",           // Subtle text
  textInverse: "#141210",         // Text on light surfaces

  // ── Brand Colors ─────────────────────────────────────────────
  primary: "#c9956a",             // Antique bronze
  primaryHover: "#d4a87a",        // Bronze highlight
  primaryDeep: "#8b6914",         // Deep bronze (for gradients)
  accent: "#e8b86d",              // Warm gold (highlights, CTAs)
  accentLight: "rgba(232, 184, 109, 0.12)",  // Accent wash

  // ── Borders ─────────────────────────────────────────────────
  border: "#2e2925",              // Subtle border
  borderStrong: "#3d3530",        // Stronger border
  borderAccent: "rgba(201, 149, 106, 0.3)",  // Accent border

  // ── Semantic ────────────────────────────────────────────────
  error: "#ef6c6c",               // Muted red (not harsh)
  errorBg: "rgba(239, 108, 108, 0.1)",
  success: "#7cb377",              // Muted green
  successBg: "rgba(124, 179, 119, 0.1)",
  warning: "#e8b86d",             // Gold warning
  warningBg: "rgba(232, 184, 109, 0.1)",
  info: "#7aa2c9",                // Muted blue
  infoBg: "rgba(122, 162, 201, 0.1)",

  // ── Shadows ─────────────────────────────────────────────────
  shadowSm: "0 1px 2px rgba(0,0,0,0.3)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.4)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.5)",
  shadowGlow: "0 0 20px rgba(201, 149, 106, 0.15)",  // Bronze glow

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
  transitionSpring: "0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",  // Slight bounce

  // ── Layout ─────────────────────────────────────────────────
  maxWidth: "1400px",
  headerHeight: "60px",
  sidebarWidth: "280px",
} as const;

export type DesignTokens = typeof tokens;

/* ── Semantic aliases for backward compatibility ── */
export const C = tokens;
