// 投票状态：避免在业务代码中直接使用魔术数字
export const VOTE_STATUS = Object.freeze({
  // 赞同
  UPVOTE: 1,
  // 反对
  DOWNVOTE: -1,
  // 未投票
  NONE: 0,
});
