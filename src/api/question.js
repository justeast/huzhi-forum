import { http } from "./http";

// 获取问题列表（GET /question/）
// params: { page?: number, size?: number }
export const fetchQuestionList = async (params = {}) => {
  const res = await http.get("/question/", {
    params: {
      page: params.page || 1,
      size: params.size || 10,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取问题列表失败");
  }

  return res.data.data;
};

// 获取用户关注的问题（GET /user/following/questions/）
// params: { page?: number, size?: number }
export const fetchFollowingQuestionList = async (params = {}) => {
  const res = await http.get("/user/following/questions/", {
    params: {
      page: params.page || 1,
      size: params.size || 10,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取关注的问题失败");
  }

  return res.data.data;
};
