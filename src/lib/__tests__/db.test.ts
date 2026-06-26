import { describe, it, expect } from 'vitest';
import { isMissingColumnError, isMissingTableError, stripNutrientFields } from '../db';
import { ALL_NUTRIENT_KEYS } from '../nutrientReference';

describe('isMissingColumnError', () => {
  it('returns false for null', () => {
    expect(isMissingColumnError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isMissingColumnError(undefined)).toBe(false);
  });

  it('returns true for PGRST204 code', () => {
    expect(isMissingColumnError({ code: 'PGRST204' })).toBe(true);
  });

  it('returns true when message mentions "schema cache"', () => {
    expect(isMissingColumnError({ message: 'Could not find the schema cache' })).toBe(true);
  });

  it('returns true when message says "could not find" + "column"', () => {
    expect(isMissingColumnError({ message: "Could not find the 'omega_3_g' column in the schema cache" })).toBe(true);
  });

  it('returns false for an unrelated error code', () => {
    expect(isMissingColumnError({ code: '42P01', message: 'table not found' })).toBe(false);
  });

  it('returns false for an empty error object', () => {
    expect(isMissingColumnError({})).toBe(false);
  });
});

describe('isMissingTableError', () => {
  it('returns false for null', () => {
    expect(isMissingTableError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isMissingTableError(undefined)).toBe(false);
  });

  it('returns true for PostgreSQL error code 42P01', () => {
    expect(isMissingTableError({ code: '42P01' })).toBe(true);
  });

  it('returns true for PGRST205 code', () => {
    expect(isMissingTableError({ code: 'PGRST205' })).toBe(true);
  });

  it('returns true when message says "does not exist"', () => {
    expect(isMissingTableError({ message: 'relation "supplement_log" does not exist' })).toBe(true);
  });

  it('returns true when message says "could not find the table"', () => {
    expect(isMissingTableError({ message: 'Could not find the table' })).toBe(true);
  });

  it('returns false for an unrelated error', () => {
    expect(isMissingTableError({ code: 'PGRST204', message: 'schema cache miss' })).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isMissingTableError({})).toBe(false);
  });
});

describe('stripNutrientFields', () => {
  it('removes all tracked nutrient keys', () => {
    const row: Record<string, unknown> = { food_name: 'Apple', calories: 95 };
    for (const key of ALL_NUTRIENT_KEYS) row[key] = 10;
    const stripped = stripNutrientFields(row);
    for (const key of ALL_NUTRIENT_KEYS) {
      expect(key in stripped).toBe(false);
    }
  });

  it('preserves non-nutrient fields', () => {
    const row = { food_name: 'Apple', calories: 95, vitamin_c_mg: 8 };
    const stripped = stripNutrientFields(row);
    expect(stripped.food_name).toBe('Apple');
    expect(stripped.calories).toBe(95);
  });

  it('does not mutate the original object', () => {
    const row = { food_name: 'Apple', vitamin_c_mg: 8 };
    stripNutrientFields(row);
    expect(row.vitamin_c_mg).toBe(8);
  });

  it('handles an object with no nutrient fields gracefully', () => {
    const row = { food_name: 'Apple', calories: 95 };
    expect(stripNutrientFields(row)).toEqual({ food_name: 'Apple', calories: 95 });
  });

  it('returns an empty object when given an empty object', () => {
    expect(stripNutrientFields({})).toEqual({});
  });
});
