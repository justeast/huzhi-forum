import { http } from "./http";

// 获取用户的回答（GET /user/answers/）
// params: { page?: number, size?: number }
export const fetchUserAnswerList = async (params = {}) => {
  const res = await http.get("/user/answers/", {
    params: {
      page: params.page || 1,
      size: params.size || 10,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取回答列表失败");
  }

  return res.data.data;
};

