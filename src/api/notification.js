import { http } from "./http";

export const fetchNotificationPage = async (paramsOrUrl = {}) => {
  const res =
    typeof paramsOrUrl === "string"
      ? await http.get(paramsOrUrl)
      : await http.get("/user/notifications/", { params: paramsOrUrl });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取通知列表失败");
  }

  return res.data.data;
};

export const fetchUnreadNotificationCount = async () => {
  const res = await http.get("/user/notifications/unread-count/");

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取通知未读数失败");
  }

  return res.data.data;
};

export const markNotificationRead = async (notificationId) => {
  const id = String(notificationId || "").trim();
  if (!id) throw new Error("缺少通知ID");

  const res = await http.patch(`/user/notifications/${id}/read/`);

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "标记通知已读失败");
  }

  return res.data.data;
};

export const markAllNotificationsRead = async () => {
  const res = await http.post("/user/notifications/read-all/");

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "标记全部通知已读失败");
  }

  return res.data.data;
};
