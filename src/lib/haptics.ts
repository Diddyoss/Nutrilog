/**
 * Haptic feedback via the Vibration API. Fires on supporting devices
 * (Android Chrome et al.) and no-ops silently everywhere else (iOS Safari
 * has no web vibration support). Patterns are deliberately short — haptics
 * should be felt, not noticed.
 */

export type HapticKind = 'light' | 'medium' | 'success' | 'warning';

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10, // selection ticks: tabs, chips, period changes
  medium: 20, // meaningful commits: confirmed delete, drag-dismiss
  success: [10, 40, 15], // a save landed
  warning: [25, 50, 25], // arming a destructive action
};

export function haptic(kind: HapticKind = 'light'): void {
  try {
    navigator.vibrate?.(PATTERNS[kind]);
  } catch {
    // Vibration blocked or unsupported — feedback is a bonus, never an error.
  }
}
