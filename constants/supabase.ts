// constants/supabase.ts
// The one connection to the backend. Every query in the app goes through
// this client — nothing else should ever construct its own.
//
// The URL and key come from .env, which is gitignored. They're read via
// process.env at BUILD time, not runtime: Expo inlines any variable prefixed
// EXPO_PUBLIC_ into the bundle. That's why the prefix is mandatory — without
// it the value arrives as undefined and every request fails with no
// explanation.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/* Fail LOUDLY here rather than mysteriously later. A missing .env produces a
   client that looks fine and then returns "Invalid API key" on every call —
   this turns that into one clear message at startup. */
if (!url || !key) {
  throw new Error(
    "Supabase env vars missing. Check .env exists in the project root with " +
      "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY, then restart " +
      "with: npx expo start -c"
  );
}

export const supabase = createClient(url, key, {
  auth: {
    /* WITHOUT this the user is signed out every time the app closes. Supabase
       defaults to browser localStorage, which doesn't exist in React Native,
       so the session has nowhere to live between launches. */
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    /* React Native has no URL bar for OAuth to redirect back through — the
       deep-link handler does that job instead. */
    detectSessionInUrl: false,
  },
});