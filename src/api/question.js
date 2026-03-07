import { http } from "./http";

// 获取问题列表（GET /question/）
// params: { page?: number, size?: number, search?: string, scene?: string, topics?: string|string[] }
export const fetchQuestionList = async (params = {}) => {
  const topics =
    Array.isArray(params?.topics) ? params.topics.filter(Boolean).join(",") : params?.topics;

  const res = await http.get("/question/", {
    params: {
      page: params.page || 1,
      size: params.size || 10,
      search: params.search || undefined,
      scene: params.scene || undefined,
      topics: topics || undefined,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取问题列表失败");
  }

  return res.data.data;
};

// 获取用户关注的问题（GET /user/following/questions/）
// params: { page?: number, size?: number, search?: string }
export const fetchFollowingQuestionList = async (params = {}) => {
  const res = await http.get("/user/following/questions/", {
    params: {
      page: params.page || 1,
      size: params.size || 10,
      search: params.search || undefined,
      user_id: params.user_id || undefined,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取关注的问题失败");
  }

  return res.data.data;
};

// 获取用户的提问（GET /user/questions/）
// params: { page?: number, size?: number }
export const fetchUserQuestionList = async (params = {}) => {
  const res = await http.get("/user/questions/", {
    params: {
      page: params.page || 1,
      size: params.size || 10,
      user_id: params.user_id || undefined,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取提问列表失败");
  }

  return res.data.data;
};

// 获取问题详情（GET /question/{question_id}/）
export const fetchQuestionDetail = async (questionId) => {
  if (!questionId) throw new Error("问题ID不能为空");

  const res = await http.get(`/question/${questionId}/`);

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取问题详情失败");
  }

  return res.data.data;
};

// 关注/取消关注问题（POST /question/{question_id}/follow/）
// action: 1-关注、2-取消关注
export const toggleQuestionFollow = async (questionId, action) => {
  if (!questionId) throw new Error("缺少问题ID");
  const act = Number(action);
  if (![1, 2].includes(act)) throw new Error("无效的关注操作");

  const res = await http.post(`/question/${questionId}/follow/`, {
    action: act,
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "操作失败");
  }

  return res.data.data;
};

// 对问题投票（POST /question/{question_id}/vote/）
// voteType: 1=赞同, -1=反对, 0=取消投票
export const voteQuestion = async (questionId, voteType) => {
  if (!questionId) throw new Error("缺少问题ID");
  const vt = Number(voteType);
  if (![1, 0, -1].includes(vt)) throw new Error("无效的投票类型");

  const res = await http.post(`/question/${questionId}/vote/`, {
    vote_type: vt,
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "投票失败");
  }

  return res.data.data;
};

// 创建问题（POST /question/）
// payload: { title: string, content?: string, topic_ids?: string[] }
export const createQuestion = async (payload = {}) => {
  const title = String(payload?.title || "").trim();
  if (!title) throw new Error("问题标题不能为空");

  const body = {
    title,
  };

  const content = payload?.content;
  if (content !== undefined) {
    body.content = String(content || "");
  }

  if (Array.isArray(payload?.topic_ids)) {
    body.topic_ids = payload.topic_ids.filter((x) => Boolean(x));
  }

  const res = await http.post("/question/", body);

  // 文档为 201 Created，兼容部分环境返回 200
  if (![200, 201].includes(Number(res?.status)) || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "创建问题失败");
  }

  return res.data.data;
};
