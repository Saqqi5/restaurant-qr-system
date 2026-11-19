import { useState, useEffect } from "react";

// Live clock: re-renders the component every `intervalMs` (default 30s)
// so time-based colours flip on their own — a served order turns from
// yellow to red 20 minutes after serving, with no refresh and no new
// order snapshot needed.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
