// Simple helper for the View Transitions API.
// Works in Chromium-based browsers; gracefully falls back elsewhere.

export function withViewTransition(fn: () => void) {
  const anyDoc = document as any;
  if (typeof anyDoc?.startViewTransition === "function") {
    anyDoc.startViewTransition(() => fn());
    return;
  }
  fn();
}
