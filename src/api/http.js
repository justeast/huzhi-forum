import axios from "axios";
import { message } from "ant-design-vue";
import router from "../router";
import { useAuthStore } from "../stores/auth";

// 统一的 HTTP 实例：基础地址来自 .env 的 VITE_API_BASE
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "",
  timeout: 15000,
});

// 从本地存储读取登录信息（避免在这里直接依赖 pinia，防止循环依赖）
const readAuthFromStorage = () => {
  try {
    const raw = localStorage.getItem("huzhi_auth");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// 请求拦截：自动拼接 JWT 到 Authorization Header
http.interceptors.request.use((config) => {
  const auth = readAuthFromStorage();
  const token = auth?.accessToken;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isHandling401 = false;

// 响应拦截：遇到 401（登录过期/未认证）时清理登录态并跳转到登录页
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      error.__handled401 = true;

      if (!isHandling401) {
        isHandling401 = true;

        try {
          useAuthStore().logout();
        } catch {
          try {
            localStorage.removeItem("huzhi_auth");
          } catch {
            // 忽略
          }
        }

        try {
          const current = router.currentRoute?.value;
          const redirect = current?.fullPath;
          if (current?.path !== "/auth") {
            router.replace({
              path: "/auth",
              query: redirect ? { redirect } : {},
            });
          }
        } catch {
          // 路由不可用时兜底刷新到登录页
          window.location.href = "/auth";
        }

        message.warning("登录已过期，请重新登录");

        setTimeout(() => {
          isHandling401 = false;
        }, 1200);
      }
    }

    return Promise.reject(error);
  },
);
