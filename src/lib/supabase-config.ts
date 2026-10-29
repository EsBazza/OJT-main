const placeholderPattern = /(?:your[-_ ]?project|project[-_ ]?ref|your[-_ ]?anon[-_ ]?key|placeholder|example\.com)/i;

export function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || placeholderPattern.test(url) || placeholderPattern.test(anonKey)) return null;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname ? { url, anonKey } : null;
  } catch {
    return null;
  }
}

export function hasSupabaseCredentials(): boolean {
  return supabaseConfig() !== null;
}
