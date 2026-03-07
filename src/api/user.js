import { http } from "./http";

// 获取用户详情（自己）（GET /user/profile/）
export const fetchUserProfile = async () => {
  const res = await http.get("/user/profile/");
  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取用户详情失败");
  }
  return res.data.data;
};

// 获取他人详情（GET /user/{user_id}/profile/）
export const fetchOtherUserProfile = async (userId) => {
  const id = String(userId || "").trim();
  if (!id) throw new Error("缺少用户ID");

  const res = await http.get(`/user/${id}/profile/`);
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
// params: { user_id?: string }
export const fetchUserAchievements = async (params = {}) => {
  const res = await http.get("/user/achievements/", {
    params: {
      user_id: params.user_id || undefined,
    },
  });
  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取用户个人成就失败");
  }
  return res.data.data;
};

// 获取用户关注的人（GET /user/following/users/）
// params: { page?: number, size?: number, user_id?: string }
export const fetchFollowingUsers = async (params = {}) => {
  const res = await http.get("/user/following/users/", {
    params: {
      page: params.page || 1,
      size: params.size || 20,
      user_id: params.user_id || undefined,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取关注的人失败");
  }

  return res.data.data;
};

// 获取关注用户的人（GET /user/followers/users/）
// params: { page?: number, size?: number, user_id?: string }
export const fetchFollowerUsers = async (params = {}) => {
  const res = await http.get("/user/followers/users/", {
    params: {
      page: params.page || 1,
      size: params.size || 20,
      user_id: params.user_id || undefined,
    },
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取关注我的人失败");
  }

  return res.data.data;
};

// 关注/取消关注用户（POST /user/{user_id}/follow/）
// action: 1-关注、2-取消关注
export const toggleUserFollow = async (userId, action) => {
  const id = String(userId || "").trim();
  if (!id) throw new Error("缺少用户ID");
  if (![1, 2].includes(Number(action))) throw new Error("无效的关注操作");

  const res = await http.post(`/user/${id}/follow/`, {
    action: Number(action),
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "操作失败");
  }

  return res.data.data;
};

// 获取用户卡片信息（GET /user/{user_id}/card/）
export const fetchUserCard = async (userId) => {
  const id = String(userId || "").trim();
  if (!id) throw new Error("缺少用户ID");

  const res = await http.get(`/user/${id}/card/`);

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取用户卡片信息失败");
  }

  return res.data.data;
};

