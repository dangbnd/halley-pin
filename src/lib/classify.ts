import "server-only";

/**
 * NOTE:
 * - Hàm này chỉ được gọi từ WORKER / job runner (không gọi trong API request).
 * - Nếu ENABLE_CLASSIFICATION=false => luôn trả unknown.
 * - Nếu ENABLE_LOCAL_CLIP=true => dùng @xenova/transformers (nặng).
 */

type CategoryKey =
  | "banh-ve"
  | "bong-lan-trung-muoi"
  | "banh-hoa-qua"
  | "banh-hoa"
  | "banh-kem"
  | "khac"
  | "unknown";

const CATEGORY_PROMPTS: { category: Exclude<CategoryKey, "unknown">; prompts: string[] }[] = [
  {
    category: "bong-lan-trung-muoi",
    prompts: [
      "bánh bông lan trứng muối",
      "bông lan trứng muối chà bông",
      "salted egg sponge cake",
      "salted egg yolk cake",
      "Vietnamese salted egg sponge cake",
    ],
  },
  {
    category: "banh-hoa-qua",
    prompts: [
      "bánh hoa quả",
      "fruit cake with fresh fruits",
      "cake topped with strawberries and fruits",
      "fruit tart cake",
    ],
  },
  {
    category: "banh-hoa",
    prompts: [
      "bánh hoa",
      "floral cake",
      "cake decorated with flowers",
      "buttercream flower cake",
    ],
  },
  {
    category: "banh-ve",
    prompts: [
      "bánh vẽ",
      "hand-painted cake",
      "cake with drawing",
      "illustration on cake",
      "cartoon cake drawing",
    ],
  },
  {
    category: "banh-kem",
    prompts: ["bánh kem", "birthday cake", "cream cake", "frosted cake", "layer cake"],
  },
  { category: "khac", prompts: ["dessert", "cake", "pastry", "food"] },
];

function flattenPrompts() {
  const map: { label: string; category: Exclude<CategoryKey, "unknown"> }[] = [];
  for (const c of CATEGORY_PROMPTS) for (const p of c.prompts) map.push({ label: p, category: c.category });
  return map;
}
const PROMPT_MAP = flattenPrompts();

const g = globalThis as unknown as { __clip?: any };

async function getClipPipeline() {
  if (g.__clip) return g.__clip;
  const { pipeline } = await import("@xenova/transformers");
  g.__clip = await pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32");
  return g.__clip;
}

export type ClassifyResult = {
  category: CategoryKey;
  confidence: number;
  tags: string[];
  top: { label: string; score: number }[];
};

export async function classifyImage(imageUrl: string): Promise<ClassifyResult> {
  const enabled = (process.env.ENABLE_CLASSIFICATION ?? "false").toLowerCase() === "true";
  if (!enabled) {
    return { category: "unknown", confidence: 0, tags: [], top: [] };
  }

  const localClip = (process.env.ENABLE_LOCAL_CLIP ?? "false").toLowerCase() === "true";
  if (!localClip) {
    // Lightweight fallback: không đoán bừa. Bạn có thể thay bằng OpenAI/Replicate nếu muốn.
    return { category: "unknown", confidence: 0, tags: [], top: [] };
  }

  const threshold = Number(process.env.CLASSIFY_THRESHOLD ?? "0.22") || 0.22;

  const classifier = await getClipPipeline();
  const candidate_labels = PROMPT_MAP.map((x) => x.label);
  const results: { label: string; score: number }[] = await classifier(imageUrl, { candidate_labels });

  const bestByCategory = new Map<Exclude<CategoryKey, "unknown">, number>();
  for (const r of results.slice(0, 30)) {
    const match = PROMPT_MAP.find((x) => x.label === r.label);
    if (!match) continue;
    const prev = bestByCategory.get(match.category) ?? 0;
    if (r.score > prev) bestByCategory.set(match.category, r.score);
  }

  let bestCategory: CategoryKey = "unknown";
  let bestScore = 0;
  for (const [cat, score] of bestByCategory.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }
  if (bestScore < threshold) bestCategory = "unknown";

  // tags suggestion: lấy 2 label top làm tag demo (bạn có thể thay logic)
  const tags = results
    .slice(0, 5)
    .map((r) => r.label.split(" ")[0]?.toLowerCase())
    .filter(Boolean)
    .slice(0, 2) as string[];

  return { category: bestCategory, confidence: bestScore, tags, top: results.slice(0, 5) };
}
