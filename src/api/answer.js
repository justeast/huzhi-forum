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

// 获取回答列表（GET /answer/）
// params: { page?: number, size?: number, question: string }
export const fetchAnswerList = async (params = {}) => {
  if (!params?.question) throw new Error("缺少问题ID");

  const res = await http.get("/answer/", {
    params: {
      page: params.page || 1,
      size: params.size || 10,
      question: params.question,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取回答列表失败");
  }

  return res.data.data;
};

// 对回答投票（POST /answer/{answer_id}/vote/）
// voteType: 1=赞同, -1=反对, 0=取消投票
export const voteAnswer = async (answerId, voteType) => {
  if (!answerId) throw new Error("缺少回答ID");
  const vt = Number(voteType);
  if (![1, 0, -1].includes(vt)) throw new Error("无效的投票类型");

  const res = await http.post(`/answer/${answerId}/vote/`, {
    vote_type: vt,
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "投票失败");
  }

  return res.data.data;
};
