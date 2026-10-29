"use client";

import { useEffect, useState } from "react";

function format(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

// Live "working for" counter while a student is timed in.
export function ElapsedTimer({ since }: { since: string }) {
  const start = new Date(since).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="elapsed">
      <span className="elapsed-dot" aria-hidden="true" />
      <span>Working for <span aria-hidden="true">{now ? format(now - start) : "…"}</span><span className="sr-only">since {new Date(since).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })}</span></span>
    </span>
  );
}
