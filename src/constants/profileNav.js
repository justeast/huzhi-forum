// 我的主页 Tab 常量：避免在业务代码里使用魔术字符串
export const PROFILE_TAB = Object.freeze({
  // 回答
  ANSWERS: "answers",
  // 提问
  QUESTIONS: "questions",
  // 收藏
  COLLECTIONS: "collections",
  // 关注
  FOLLOWS: "follows",
});

export const PROFILE_FOLLOW_TAB = Object.freeze({
  // 我关注的问题
  QUESTIONS: "follow-questions",
  // 我关注的话题
  TOPICS: "follow-topics",
  // 我关注的人
  USERS_FOLLOWING: "follow-users-following",
  // 关注我的人
  USERS_FOLLOWERS: "follow-users-followers",
});

// Tab 渲染配置（key + 文案），便于 v-for 渲染并减少模板重复
export const PROFILE_TAB_LIST = Object.freeze([
  { key: PROFILE_TAB.ANSWERS, label: "回答" },
  { key: PROFILE_TAB.QUESTIONS, label: "提问" },
  { key: PROFILE_TAB.COLLECTIONS, label: "收藏" },
  { key: PROFILE_TAB.FOLLOWS, label: "关注" },
]);

export const PROFILE_FOLLOW_TAB_LIST = Object.freeze([
  { key: PROFILE_FOLLOW_TAB.QUESTIONS, label: "我关注的问题" },
  { key: PROFILE_FOLLOW_TAB.TOPICS, label: "我关注的话题" },
  { key: PROFILE_FOLLOW_TAB.USERS_FOLLOWING, label: "我关注的人" },
  { key: PROFILE_FOLLOW_TAB.USERS_FOLLOWERS, label: "关注我的人" },
]);
