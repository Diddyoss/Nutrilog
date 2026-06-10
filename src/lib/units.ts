import type { Units } from '../types';

const LBS_PER_KG = 2.20462;
const CM_PER_IN = 2.54;

export function kgToLbs(kg: number): number {
  return kg * LBS_PER_KG;
}

export function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG;
}

export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = cm / CM_PER_IN;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) {
    ft += 1;
    inch = 0;
  }
  return { ft, inch };
}

export function ftInToCm(ft: number, inch: number): number {
  return (ft * 12 + inch) * CM_PER_IN;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatWeight(kg: number, units: Units): string {
  return units === 'imperial' ? `${round1(kgToLbs(kg))} lbs` : `${round1(kg)} kg`;
}

export function formatHeight(cm: number, units: Units): string {
  if (units === 'imperial') {
    const { ft, inch } = cmToFtIn(cm);
    return `${ft}'${inch}"`;
  }
  return `${Math.round(cm)} cm`;
}
