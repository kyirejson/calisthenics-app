import type { Profile } from '../types';

/** Missing imported body data stays unconfirmed; never invent a healthy adult profile. */
export function normalizeBodyMetrics(raw: Partial<Profile> & Record<string, unknown>): Pick<Profile, 'sex' | 'age' | 'height' | 'weight'> {
  const number = (value: unknown) => {
    if (typeof value !== 'number' && typeof value !== 'string') return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    sex: raw.sex === 'male' || raw.sex === 'female' ? raw.sex : 'unspecified',
    age: number(raw.age), height: number(raw.height), weight: number(raw.weight),
  };
}
