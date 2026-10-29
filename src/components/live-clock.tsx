"use client";

import { useEffect, useState } from "react";

const format = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" });

// Shows Manila time; the server still records the official timestamp.
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <div className="clock" aria-hidden="true">{now ? format.format(now) : "—"}</div>;
}
