import { describe, it, expect } from 'vitest';
import { isMissingColumnError, isMissingTableError, stripNutrientFields } from './db';

describe('isMissingColumnError', () => {
  it('detects the PGRST204 error code regardless of message', () => {
    expect(isMissingColumnError({ code: 'PGRST204', message: 'anything' })).toBe(true);
  });

  it('detects a "schema cache" message even without the PGRST204 code', () => {
    expect(
      isMissingColumnError({ message: "Could not find the 'omega_3_g' column in the schema cache" })
    ).toBe(true);
  });

  it('detects a "could not find ... column" message case-insensitively', () => {
    expect(isMissingColumnError({ message: "COULD NOT FIND the 'fiber_g' COLUMN" })).toBe(true);
  });

  it('returns false for an unrelated error', () => {
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key value' })).toBe(false);
  });

  it('returns false for null/undefined (no error occurred)', () => {
    expect(isMissingColumnError(null)).toBe(false);
    expect(isMissingColumnError(undefined)).toBe(false);
  });
});

describe('isMissingTableError', () => {
  it('detects the Postgres 42P01 "undefined table" code', () => {
    expect(isMissingTableError({ code: '42P01' })).toBe(true);
  });

  it('detects the PostgREST PGRST205 code', () => {
    expect(isMissingTableError({ code: 'PGRST205' })).toBe(true);
  });

  it('detects a "does not exist" message without a matching code', () => {
    expect(isMissingTableError({ message: 'relation "coach_log" does not exist' })).toBe(true);
  });

  it('returns false for an unrelated error', () => {
    expect(isMissingTableError({ code: '23505', message: 'duplicate key value' })).toBe(false);
  });

  it('returns false for null/undefined (no error occurred)', () => {
    expect(isMissingTableError(null)).toBe(false);
  });
});

describe('stripNutrientFields', () => {
  it('removes every tracked nutrient key and keeps the non-nutrient fields', () => {
    const row = {
      food_name: 'Chicken Rice',
      calories: 650,
      protein_g: 35,
      vitamin_c_mg: 4,
      iron_mg: 2.1,
      omega_3_g: 0.3,
    };
    expect(stripNutrientFields(row)).toEqual({
      food_name: 'Chicken Rice',
      calories: 650,
      protein_g: 35,
    });
  });

  it('does not mutate the original object', () => {
    const row = { food_name: 'Oats', vitamin_c_mg: 1 };
    const original = { ...row };
    stripNutrientFields(row);
    expect(row).toEqual(original);
  });

  it('is a no-op when no nutrient fields are present', () => {
    const row = { food_name: 'Water', calories: 0 };
    expect(stripNutrientFields(row)).toEqual(row);
  });
});
