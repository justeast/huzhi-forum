// 首页导航 Tab 常量：避免在业务代码里使用魔术字符串
export const HOME_NAV = Object.freeze({
  // 问答
  QA: "qa",
  // 关注的问题
  FOLLOW_QUESTIONS: "follow-questions",
  // 关注的话题
  FOLLOW_TOPICS: "follow-topics",
  // 话题
  TOPICS: "topics",
});

// 首页主 Tab 渲染配置（顶部的“问答 / 话题”）
export const HOME_MAIN_TAB_LIST = Object.freeze([
  { key: HOME_NAV.QA, label: "问答" },
  { key: HOME_NAV.TOPICS, label: "话题" },
]);

// “关注”下拉项渲染配置
export const HOME_FOLLOW_TAB_LIST = Object.freeze([
  { key: HOME_NAV.FOLLOW_QUESTIONS, label: "关注的问题" },
  { key: HOME_NAV.FOLLOW_TOPICS, label: "关注的话题" },
]);

// “关注”Tab 的显示文案映射（仅用于关注相关的两个态）
export const HOME_FOLLOW_LABEL_MAP = Object.freeze({
  [HOME_NAV.FOLLOW_QUESTIONS]: "关注的问题",
  [HOME_NAV.FOLLOW_TOPICS]: "关注的话题",
});
