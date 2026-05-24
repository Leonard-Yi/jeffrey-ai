// src/lib/safeLog.ts

/**
 * Log with pseudonymized content.
 * Callers should already have pseudonymized the content before calling this.
 */
export function safeLog(prefix: string, message: string): void {
  console.log(`[Jeffrey.AI] ${prefix}:`, message);
}

/**
 * Scrub a text string for logging.
 * This is a lightweight helper that can be extended with regex patterns.
 * The main protection is pseudonymization before logging.
 */
export function safeLogScrub(prefix: string, text: string): void {
  console.log(`[Jeffrey.AI] ${prefix}:`, text);
}
