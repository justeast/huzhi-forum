import axios from "axios";

// 获取 COS 临时密钥
const TOKEN_URL = "http://47.76.51.147:8013/api/upload/token/";

/**
 * 向后端请求 COS 临时密钥
 * 返回数据格式见后端示例：包含 credentials、startTime、expiredTime 等
 */
export const fetchCosToken = async () => {
  const res = await axios.get(TOKEN_URL);
  if (!res?.data || res.data.code !== 1) {
    throw new Error(res?.data?.msg || "获取 COS 临时密钥失败");
  }
  return res.data.data;
};
