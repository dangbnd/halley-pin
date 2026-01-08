import "server-only";

export function computeFinalCategory(opts: {
  aiCategory: string | null | undefined;
  userCategory: string | null | undefined;
}) {
  const user = (opts.userCategory ?? "").trim();
  if (user) return user;
  const ai = (opts.aiCategory ?? "").trim();
  if (ai) return ai;
  return "uncategorized";
}
