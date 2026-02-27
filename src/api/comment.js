import { http } from "./http";

// 获取评论列表（GET /comment/）
// 支持按回答过滤：answer
// 支持按父评论过滤（二级评论）：parent
// 支持分页：page、size
export const fetchCommentPage = async (paramsOrUrl = {}) => {
  const res =
    typeof paramsOrUrl === "string"
      ? await http.get(paramsOrUrl)
      : await http.get("/comment/", { params: paramsOrUrl });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取评论列表失败");
  }

  return res.data.data;
};

export const fetchCommentsByAnswer = async (
  answerId,
  { page = 1, size = 20 } = {},
) => {
  if (!answerId) throw new Error("缺少回答ID");
  return fetchCommentPage({ answer: answerId, page, size });
};

export const fetchCommentsByParent = async (
  parentId,
  { page = 1, size = 20 } = {},
) => {
  if (!parentId) throw new Error("缺少父评论ID");
  return fetchCommentPage({ parent: parentId, page, size });
};

// 创建评论（POST /comment/）
// 支持一级/二级评论：
// - 一级：answer_id + content
// - 二级：answer_id + content + parent_id + reply_to_id（被回复的用户id）
export const createComment = async ({
  answerId,
  content,
  parentId,
  replyToId,
} = {}) => {
  if (!answerId) throw new Error("缺少回答ID");
  const text = String(content || "").trim();
  if (!text) throw new Error("评论内容不能为空");

  const payload = {
    answer_id: answerId,
    content: text,
  };

  if (parentId) payload.parent_id = parentId;
  if (replyToId) payload.reply_to_id = replyToId;

  const res = await http.post("/comment/", payload);

  // 文档为 201 Created，兼容部分环境返回 200
  if (![200, 201].includes(Number(res?.status)) || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "创建评论失败");
  }

  return res.data.data;
};

// 点赞/取消点赞评论（POST /comment/{comment_id}/like/）
// toggle 操作，返回更新后的 comment
export const toggleLikeComment = async (commentId) => {
  if (!commentId) throw new Error("缺少评论ID");

  const res = await http.post(`/comment/${commentId}/like/`);

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "操作失败");
  }

  return res.data.data;
};

// 删除评论（DELETE /comment/{comment_id}/）
// 级联删除，返回删除后所属回答的最新评论总数（包含二级评论）：data.comment_count
export const deleteComment = async (commentId) => {
  if (!commentId) throw new Error("缺少评论ID");

  const res = await http.delete(`/comment/${commentId}/`);

  // 最新文档返回 200 + JSON；这里兼容旧实现（204）
  if (Number(res?.status) === 204) {
    return { comment_count: 0 };
  }

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "删除评论失败");
  }

  return res.data.data;
};

