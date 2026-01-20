import { defineStore } from "pinia";

const STORAGE_KEY = "huzhi_auth";

const readStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeStorage = (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // 忽略写入失败（例如浏览器禁用存储）
  }
};

const clearStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略清理失败
  }
};

export const useAuthStore = defineStore("auth", {
  state: () => {
    const cached = readStorage();
    return {
      accessToken: cached?.accessToken || "",
      refreshToken: cached?.refreshToken || "",
      userId: cached?.userId || "",
      username: cached?.username || "",
      avatar: cached?.avatar || "",
    };
  },
  getters: {
    isLoggedIn: (state) => Boolean(state.accessToken),
    avatarUrl: (state) => state.avatar || "/default-avatar.png",
  },
  actions: {
    // 写入登录态（后端登录返回 access/refresh/id/username）
    setAuth(payload) {
      this.accessToken = payload?.accessToken || "";
      this.refreshToken = payload?.refreshToken || "";
      this.userId = payload?.userId || "";
      this.username = payload?.username || "";
      this.avatar = payload?.avatar || "";

      writeStorage({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        userId: this.userId,
        username: this.username,
        avatar: this.avatar,
      });
    },
    logout() {
      this.accessToken = "";
      this.refreshToken = "";
      this.userId = "";
      this.username = "";
      this.avatar = "";
      clearStorage();
    },
  },
});
