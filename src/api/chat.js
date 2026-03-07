import { http } from "./http";

// 创建/获取会话（POST /chat/）
// payload: { receiver_id: string }
export const createOrGetChat = async (receiverId) => {
  const id = String(receiverId || "").trim();
  if (!id) throw new Error("缺少接收者ID");

  const res = await http.post("/chat/", { receiver_id: id });
  // 200：已存在；201：新建
  if (![200, 201].includes(Number(res?.status)) || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "创建/获取会话失败");
  }
  return res.data.data;
};

// 获取会话列表（GET /chat/）
// params: { page?: number, size?: number }
export const fetchChatList = async (params = {}) => {
  const res = await http.get("/chat/", {
    params: {
      page: params.page || 1,
      size: params.size || 20,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取会话列表失败");
  }

  return res.data.data;
};

// 获取历史消息（GET /chat/{chat_id}/messages/）
// params: { page?: number, size?: number }
export const fetchChatMessages = async (chatId, params = {}) => {
  const id = String(chatId || "").trim();
  if (!id) throw new Error("缺少会话ID");

  const res = await http.get(`/chat/${id}/messages/`, {
    params: {
      page: params.page || 1,
      size: params.size || 50,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取历史消息失败");
  }

  return res.data.data;
};

// 标记消息已读（POST /chat/{chat_id}/read/）
// messageIds: [] 表示标记该会话内全部“对方发给我的”未读消息
export const markChatRead = async (chatId, messageIds = []) => {
  const id = String(chatId || "").trim();
  if (!id) throw new Error("缺少会话ID");

  const res = await http.post(`/chat/${id}/read/`, {
    message_ids: Array.isArray(messageIds) ? messageIds : [],
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "标记已读失败");
  }

  return res.data.data;
};

