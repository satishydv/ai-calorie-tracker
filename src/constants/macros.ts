import type { SFSymbol } from 'expo-symbols';

/** One source of truth for macro colour + icon, used by the plan reveal, home and profile. */
export const MACROS = [
  { key: 'protein', label: 'Protein', icon: 'flame.fill', color: '#F4685C' },
  { key: 'carbs', label: 'Carbs', icon: 'leaf.fill', color: '#F0A424' },
  { key: 'fat', label: 'Fat', icon: 'drop.fill', color: '#F7C948' },
] as const satisfies readonly {
  key: string;
  label: string;
  icon: SFSymbol;
  color: string;
}[];
