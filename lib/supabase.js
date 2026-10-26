import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
export const BUCKET = 'plastic-proofs';

// Ids in the URL are shifted by 5489, so the real student id is id - 5489 (non-numeric ids are left alone)
export const ID_OFFSET = 5489;
export const realId = (v) => (/^\d+$/.test(v || '') ? String(Number(v) - ID_OFFSET) : v);

// ?theme=dark|light wins; otherwise follow the device
export function applyTheme(t) {
  const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
