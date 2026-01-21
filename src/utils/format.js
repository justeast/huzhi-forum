// 文本预览：去除多余空白并截断，适合列表摘要展示
export function toPreviewText(text, max = 160) {
  const value = (text || "").trim().replace(/\s+/g, " ");
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

// 数字格式化：如 1200 -> 1.2k
export function formatCount(value) {
  const num = Number(value) || 0;
  if (num < 1000) return `${num}`;
  const k = (num / 1000).toFixed(1).replace(/\.0$/, "");
  return `${k}k`;
}
