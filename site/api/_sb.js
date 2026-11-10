// Conexión a Supabase. Acepta los nombres de variables que crea la integración de Vercel y los manuales.
const SB = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const auth = k => (k.startsWith('eyJ') ? { Authorization: `Bearer ${k}` } : {}); // claves nuevas (sb_secret_…) solo van en apikey
const sb = (path, opts = {}) => fetch(SB + path, { ...opts, headers: { apikey: KEY, ...auth(KEY), ...opts.headers } });
module.exports = { SB, KEY, sb };
