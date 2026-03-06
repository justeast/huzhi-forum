import { http } from "./http";

// 获取话题列表（GET /topic/）
// params: { page?: number, size?: number, search?: string }
export const fetchTopicList = async (params = {}) => {
  const res = await http.get("/topic/", {
    params: {
      page: params.page || 1,
      size: params.size || 20,
      search: params.search || undefined,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取话题列表失败");
  }

  return res.data.data;
};

// 获取用户关注的话题（GET /user/following/topics/）
// params: { page?: number, size?: number, search?: string }
export const fetchFollowingTopics = async (params = {}) => {
  const res = await http.get("/user/following/topics/", {
    params: {
      page: params.page || 1,
      size: params.size || 20,
      search: params.search || undefined,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取关注的话题失败");
  }

  return res.data.data;
};

// 关注/取消关注话题（POST /topic/{topic_id}/follow/）
// action: 1-关注、2-取消关注
export const toggleTopicFollow = async (topicId, action) => {
  if (!topicId) throw new Error("缺少话题ID");
  if (![1, 2].includes(Number(action))) throw new Error("无效的关注操作");

  const res = await http.post(`/topic/${topicId}/follow/`, {
    action: Number(action),
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "操作失败");
  }

  return res.data.data;
};

// 创建话题（POST /topic/）
// payload: { name: string, icon?: string, introduction?: string }
export const createTopic = async (payload = {}) => {
  const name = String(payload?.name || "").trim();
  if (!name) throw new Error("话题名称不能为空");

  const body = {
    name,
  };

  if (payload?.icon !== undefined) body.icon = payload.icon || null;
  if (payload?.introduction !== undefined)
    body.introduction = payload.introduction || null;

  const res = await http.post("/topic/", body);

  // 文档为 201 Created，兼容部分环境返回 200
  if (![200, 201].includes(Number(res?.status)) || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "创建话题失败");
  }

  return res.data.data;
};

// 获取话题详情（GET /topic/{topic_id}/）
export const fetchTopicDetail = async (topicId) => {
  if (!topicId) throw new Error("缺少话题ID");

  const res = await http.get(`/topic/${topicId}/`);

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取话题详情失败");
  }

  return res.data.data;
};
