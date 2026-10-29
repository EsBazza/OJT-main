// Only same-site paths may be followed from a notification (no external or protocol-relative URLs).
export function safeHref(href: string | null | undefined): string | null {
  return href && href.startsWith("/") && !href.startsWith("//") && !href.includes("\\") ? href : null;
}
