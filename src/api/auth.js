import axios from "axios";

// 基础请求实例：后端基地址在 .env 中配置 VITE_API_BASE
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "",
});

// 登录（POST /user/login/）
// payload: { account: string, password: string }
export const login = async (payload) => {
  try {
    const res = await api.post("/user/login/", payload);
    if (res?.status !== 200 || res?.data?.code !== 1) {
      throw new Error(res?.data?.msg || "登录失败");
    }
    return res.data;
  } catch (error) {
    // 兼容后端返回业务错误（HTTP 200 + code != 1）与网络/非 2xx 错误
    const msg = error?.response?.data?.msg || error?.message || "登录失败";
    throw new Error(msg);
  }
};

// 注册（POST /user/register/）
// payload: { username: string, email: string, password: string }
export const register = async (payload) => {
  try {
    const res = await api.post("/user/register/", payload);
    if (res?.status !== 200 || res?.data?.code !== 1) {
      throw new Error(res?.data?.msg || "注册失败");
    }
    return res.data;
  } catch (error) {
    const msg = error?.response?.data?.msg || error?.message || "注册失败";
    throw new Error(msg);
  }
};
