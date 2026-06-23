/** ANSI color/style primitives in the Montana Labs palette. Presentation-only, no layout. */

/**
 * Build a styler that wraps a value in an ANSI escape sequence and resets afterwards.
 *
 * @param sgr - the SGR parameter(s), e.g. `'1'` (bold) or `'38;5;42'` (256-color green).
 * @returns a function that wraps its argument in that escape sequence.
 */
const style = (sgr: string) => (s: string | number): string => `\x1b[${sgr}m${s}\x1b[0m`;

/** Color/weight helpers; each wraps a string in the corresponding ANSI escape. */
export const c = {
  bold: style('1'),
  dim: style('2'),
  green: style('38;5;42'),
  red: style('38;5;203'),
  amber: style('38;5;214'),
  purple: style('38;5;141'),
  gray: style('38;5;245'),
  white: style('97'),
  cyan: style('38;5;80'),
} as const;

/** Width, in columns, of horizontal rules and panels. */
export const RULE_WIDTH = 76;

/**
 * A full-width horizontal rule.
 *
 * @returns a gray line {@link RULE_WIDTH} columns wide.
 */
export const rule = (): string => c.gray('─'.repeat(RULE_WIDTH));
