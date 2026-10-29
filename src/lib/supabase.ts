import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./supabase-config";

export { hasSupabaseCredentials } from "./supabase-config";

export async function createSupabaseServer() {
  const config = supabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase credentials are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before starting the application.",
    );
  }

  const jar = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(values: Parameters<SetAllCookies>[0]) {
        try {
          values.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; the middleware refreshes the session instead.
        }
      },
    },
  });
}
