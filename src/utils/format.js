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

// 时间格式化：输出到“分钟”（默认 zh-CN），如 2026/02/03 14:05
export function formatDateTimeMinute(value, locale = "zh-CN") {
  if (value === null || value === undefined || value === "") return "";

  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    return d.toLocaleString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

// 列表时间展示：仅当修改时间明显晚于创建时间时，才显示“编辑于”
export function formatCreatedModifiedLabel(created, modified, locale = "zh-CN") {
  const createdText = formatDateTimeMinute(created, locale);
  if (!createdText) return "";
  if (modified === null || modified === undefined || modified === "") return createdText;

  try {
    const createdDate = created instanceof Date ? created : new Date(created);
    const modifiedDate = modified instanceof Date ? modified : new Date(modified);

    if (Number.isNaN(createdDate.getTime()) || Number.isNaN(modifiedDate.getTime())) {
      return createdText;
    }

    // 界面只展示到“分钟”，这里设置 60 秒阈值，避免新建时 created / modified 的微小时间差被误判为“已编辑”
    const editedThresholdMs = 60 * 1000;
    if (modifiedDate.getTime() - createdDate.getTime() >= editedThresholdMs) {
      const modifiedText = formatDateTimeMinute(modifiedDate, locale);
      return modifiedText ? `编辑于 ${modifiedText}` : createdText;
    }

    return createdText;
  } catch {
    return createdText;
  }
}
