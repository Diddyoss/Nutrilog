import { describe, it, expect } from 'vitest';
import { gramsIn, metricAmountIn, servingQuantity } from '../serving';

describe('gramsIn', () => {
  it.each([
    ['150g', 150],
    ['150 g', 150],
    ['150 grams', 150],
    ['1 gram', 1],
    ['12.5g', 12.5],
    ['12,5 g', 12.5],
    ['1 tbsp (14 g)', 14],
    ['2 slices (60g)', 60],
  ])('%s -> %s', (input, expected) => {
    expect(gramsIn(input)).toBe(expected);
  });

  it('prefers the parenthesised amount', () => {
    expect(gramsIn('100g bag, 1 portion (30 g)')).toBe(30);
  });

  it.each(['250 ml', '1 cup', '2 eggs', '1 kg', '1kg', ''])('ignores %j', (input) => {
    expect(gramsIn(input)).toBeNull();
  });
});

describe('metricAmountIn', () => {
  it('accepts grams and millilitres', () => {
    expect(metricAmountIn('30 g')).toBe(30);
    expect(metricAmountIn('250ml')).toBe(250);
    expect(metricAmountIn('1 glass (200 ml)')).toBe(200);
  });

  it('handles "grams", which the old search-side parser missed', () => {
    expect(metricAmountIn('40 grams')).toBe(40);
  });

  it('returns null without a metric unit', () => {
    expect(metricAmountIn('1 cup')).toBeNull();
  });
});

describe('servingQuantity', () => {
  it('uses the metric amount when there is one', () => {
    expect(servingQuantity('1 tbsp (14 g)')).toBe(14);
    expect(servingQuantity('100g')).toBe(100);
  });

  it('falls back to the first number', () => {
    expect(servingQuantity('2 cups')).toBe(2);
    expect(servingQuantity('3 scoops')).toBe(3);
    expect(servingQuantity('1.5 servings')).toBe(1.5);
  });

  it('returns null with no number at all', () => {
    expect(servingQuantity('a handful')).toBeNull();
    expect(servingQuantity('')).toBeNull();
  });

  it('gives a consistent ratio for the modal rescaling (100g -> 50g halves)', () => {
    expect(servingQuantity('50g')! / servingQuantity('100g')!).toBe(0.5);
  });
});
