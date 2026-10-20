import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";

const placeholderPattern = /(?:your[-_ ]?project|project[-_ ]?ref|your[-_ ]?anon[-_ ]?key|placeholder|example\.com)/i;

export function hasSupabaseCredentials(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey || placeholderPattern.test(url) || placeholderPattern.test(anonKey)) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export async function createSupabaseServer() {
  if (!hasSupabaseCredentials()) {
    throw new Error(
      "Supabase credentials are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before starting the application.",
    );
  }

  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(values: Parameters<SetAllCookies>[0]) {
          try {
            values.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            // Server component rendering cannot always mutate cookies.
          }
        },
      },
    },
  );
}
