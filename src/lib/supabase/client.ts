import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type ApexSupabaseClient = SupabaseClient<Database>;

// Uses the public (anon/publishable) key only. Row level security limits every
// query to the signed-in technician's org, so this is safe to ship to the device.
// The NEXT_PUBLIC_ prefix assumes Next.js (matching src/app); rename if the
// framework changes. Never put the service role key here.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: ApexSupabaseClient | undefined;

/** Shared client for the app, created on first use. */
export function getSupabaseClient(): ApexSupabaseClient {
  if (!browserClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local.',
      );
    }
    browserClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return browserClient;
}
