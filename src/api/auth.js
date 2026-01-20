import { http } from "./http";

// 登录（POST /user/login/）
// payload: { account: string, password: string }
export const login = async (payload) => {
  try {
    const res = await http.post("/user/login/", payload);
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
    const res = await http.post("/user/register/", payload);
    if (res?.status !== 200 || res?.data?.code !== 1) {
      throw new Error(res?.data?.msg || "注册失败");
    }
    return res.data;
  } catch (error) {
    const msg = error?.response?.data?.msg || error?.message || "注册失败";
    throw new Error(msg);
  }
};

// 发送重置密码邮箱验证码（POST /user/pwd-reset/code/）
// payload: { email: string }
export const sendPwdResetCode = async (payload) => {
  try {
    const res = await http.post("/user/pwd-reset/code/", payload);
    if (res?.status !== 200 || res?.data?.code !== 1) {
      throw new Error(res?.data?.msg || "验证码发送失败");
    }
    return res.data;
  } catch (error) {
    const msg = error?.response?.data?.msg || error?.message || "验证码发送失败";
    throw new Error(msg);
  }
};

// 用户重置密码（POST /user/pwd-reset/）
// payload: { email: string, code: string, new_password: string }
export const resetPassword = async (payload) => {
  try {
    const res = await http.post("/user/pwd-reset/", payload);
    if (res?.status !== 200 || res?.data?.code !== 1) {
      throw new Error(res?.data?.msg || "密码重置失败");
    }
    return res.data;
  } catch (error) {
    const msg = error?.response?.data?.msg || error?.message || "密码重置失败";
    throw new Error(msg);
  }
};
