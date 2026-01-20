import axios from "axios";

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

