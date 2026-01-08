export type Photo = {
  id: string;
  // Large image (detail/lightbox)
  src: string;
  // Smaller, fast thumbnail for feeds
  thumbSrc: string;
  width: number;
  height: number;
  title: string;
  tags: string[];
  blurDataURL: string;

  aiCategory: string | null;
  aiConfidence: number;

  userCategory: string | null;
  finalCategory: string;

  classifyStatus: "queued" | "processing" | "done" | "failed" | null;
  classifyError?: string | null;
};

// Light neutral blur placeholder (works well with Pinterest-like light UI)
export const DEFAULT_BLUR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNicgaGVpZ2h0PScxMCc+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSdnJyB4MT0nMCcgeDI9JzEnPjxzdG9wIG9mZnNldD0nMCcgc3RvcC1jb2xvcj0nI2Y0ZjRmNScvPjxzdG9wIG9mZnNldD0nMScgc3RvcC1jb2xvcj0nI2U0ZTRlNycvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPScxNicgaGVpZ2h0PScxMCcgZmlsbD0ndXJsKCNnKScvPjwvc3ZnPg==";

// Optional: chỉ để demo UI (không phải danh sách tags thật trong DB)
export const FEATURED_TAGS = [
  "editorial",
  "minimal",
  "dark",
  "neon",
  "portrait",
  "abstract",
  "street",
  "texture",
  "metal",
  "grid",
  "calm",
];

export const CATEGORIES = [
  { key: "uncategorized", label: "Chưa phân loại" },
  { key: "banh-ve", label: "Bánh vẽ" },
  { key: "bong-lan-trung-muoi", label: "Bông lan trứng muối" },
  { key: "banh-hoa-qua", label: "Bánh hoa quả" },
  { key: "banh-hoa", label: "Bánh hoa" },
  { key: "banh-kem", label: "Bánh kem" },
  { key: "khac", label: "Khác" },
] as const;
