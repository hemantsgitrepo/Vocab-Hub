/**
 * Trims and uppercases the first character, leaving the rest of the text as-is.
 * Already-capitalized text and non-letter leading characters pass through
 * unchanged, so this is safe to apply repeatedly.
 */
export function capitalizeFirst(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}
