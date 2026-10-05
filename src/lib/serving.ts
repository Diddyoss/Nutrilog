/**
 * Reading quantities out of free-text serving sizes ("150g", "1 tbsp (14 g)",
 * "2 cups"). One place so the add-food search and the Confirm Food modal agree.
 */

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;

function toNumber(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

/** Amount tagged with one of `units`; a parenthesised amount wins ("1 tbsp (14 g)" -> 14). */
function amountIn(s: string, units: string): number | null {
  const paren = s.match(new RegExp(String.raw`\(\s*${NUM}\s*(?:${units})\s*\)`, 'i'));
  if (paren) return toNumber(paren[1]);
  const plain = s.match(new RegExp(String.raw`${NUM}\s*(?:${units})\b`, 'i'));
  return plain ? toNumber(plain[1]) : null;
}

/** Grams in a serving: "150g", "150 grams", "1 tbsp (14 g)". Millilitres are not grams. */
export function gramsIn(s: string): number | null {
  return amountIn(s, 'g|grams?');
}

/** Grams or millilitres, treating 1 ml ≈ 1 g (what nutrition labels assume per 100). */
export function metricAmountIn(s: string): number | null {
  return amountIn(s, 'g|grams?|ml');
}

/**
 * The number to rescale against when the serving changes: the metric amount
 * if there is one, else the first number ("2 cups" -> 2, "3 scoops" -> 3).
 */
export function servingQuantity(s: string): number | null {
  const metric = metricAmountIn(s);
  if (metric !== null) return metric;
  const any = s.match(new RegExp(NUM));
  return any ? toNumber(any[1]) : null;
}
