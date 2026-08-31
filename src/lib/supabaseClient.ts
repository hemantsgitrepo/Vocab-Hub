// ---------------------------------------------------------------------------
// Supabase client — the only network-backed persistence layer in the app so
// far (everything else stays in WatermelonDB, fully offline, see src/db/).
//
// Config comes from EXPO_PUBLIC_* env vars (see .env.example), never hardcoded
// here. Only the `anon` key belongs in this file — it's meant to ship inside
// the client bundle and is safe because Supabase's Row Level Security (not
// key secrecy) is what actually protects the data. The `service_role` key
// must NEVER appear in this app; it only belongs in a server-side function.
// ---------------------------------------------------------------------------
import 'react-native-url-polyfill/auto'; // supabase-js needs a real URL global, RN doesn't ship one
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env and fill in your project values.'
  );
}

/**
 * Session storage backed by the OS keystore (Keychain on iOS, Keystore on
 * Android) rather than plain-text AsyncStorage, since this holds an auth
 * session. NOTE: SecureStore enforces a ~2048-byte per-key limit on some
 * platforms — fine for a single access+refresh token pair today, but if the
 * session payload grows, switch to the "encrypted blob in AsyncStorage, key
 * in SecureStore" pattern Supabase's own docs describe.
 */
const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // The app never lands on a web callback URL for OAuth, so no session
    // should ever be parsed out of one.
    detectSessionInUrl: false,
  },
});
