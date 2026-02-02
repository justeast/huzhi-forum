import { http } from "./http";

// 获取用户详情（GET /user/profile/）
export const fetchUserProfile = async () => {
  const res = await http.get("/user/profile/");
  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取用户详情失败");
  }
  return res.data.data;
};

// 修改个人信息（PATCH /user/profile/）
// payload: { username?, email?, phone?, avatar?, cover_image?, bio? }
export const patchUserProfile = async (payload = {}) => {
  const res = await http.patch("/user/profile/", payload);
  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "修改个人信息失败");
  }
  return res.data.data;
};

// 获取用户个人成就（GET /user/achievements/）
// 返回：{ agree_count: number, answer_count: number }
export const fetchUserAchievements = async () => {
  const res = await http.get("/user/achievements/");
  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取用户个人成就失败");
  }
  return res.data.data;
};
