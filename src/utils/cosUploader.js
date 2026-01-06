import COS from "cos-js-sdk-v5";
import { fetchCosToken } from "../api/cosToken";

// 必填配置从环境变量读取
const COS_BUCKET = import.meta.env.VITE_COS_BUCKET;
const COS_REGION = import.meta.env.VITE_COS_REGION;
const COS_PREFIX = import.meta.env.VITE_COS_PREFIX || "";

// 缓存临时密钥与 COS 客户端，避免重复请求
let cachedToken = null;
let cosClient = null;

// 校验临时密钥是否仍然有效（提前 60 秒刷新）
const isTokenValid = (token) => {
  if (!token) return false;
  const now = Math.floor(Date.now() / 1000);
  return token.expiredTime - 60 > now;
};

// 确保拿到可用的临时密钥
const ensureToken = async () => {
  if (isTokenValid(cachedToken)) return cachedToken;
  cachedToken = await fetchCosToken();
  return cachedToken;
};

// 创建并复用 COS 客户端，动态注入临时密钥
const getCosClient = () => {
  if (cosClient) return cosClient;

  cosClient = new COS({
    getAuthorization: async (_options, callback) => {
      try {
        const { credentials, startTime, expiredTime } = await ensureToken();
        callback({
          TmpSecretId: credentials.tmpSecretId,
          TmpSecretKey: credentials.tmpSecretKey,
          SecurityToken: credentials.sessionToken,
          StartTime: startTime,
          ExpiredTime: expiredTime,
        });
      } catch (error) {
        callback(error);
      }
    },
  });

  return cosClient;
};

// 可选前缀（如目录），统一管理上传路径
const buildKey = (key) => {
  if (!COS_PREFIX) return key;
  const normalizedPrefix = COS_PREFIX.endsWith("/")
    ? COS_PREFIX
    : `${COS_PREFIX}/`;
  return `${normalizedPrefix}${key}`;
};

/**
 * 上传文件到 COS
 * @param {File|Blob} file - 待上传文件
 * @param {string} key - 对象 Key（含文件名）
 * @param {object} [options]
 * @param {(p:{loaded:number,total:number,percent:number,speed:number})=>void} [options.onProgress] - 进度回调
 * @returns {Promise<{url:string,key:string,etag:string,statusCode:number}>}
 */
export const uploadToCos = async (file, key, { onProgress } = {}) => {
  if (!COS_BUCKET || !COS_REGION) {
    throw new Error("请在环境变量中配置 VITE_COS_BUCKET 和 VITE_COS_REGION");
  }
  if (!file || !key) {
    throw new Error("缺少文件或对象 Key");
  }

  const client = getCosClient();
  const objectKey = buildKey(key);

  return new Promise((resolve, reject) => {
    client.putObject(
      {
        Bucket: COS_BUCKET,
        Region: COS_REGION,
        Key: objectKey,
        Body: file,
        onProgress: (progress) => {
          if (onProgress) onProgress(progress);
        },
      },
      (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        const location = data.Location.startsWith("http")
          ? data.Location
          : `https://${data.Location}`;

        resolve({
          url: location,
          key: objectKey,
          etag: data.ETag,
          statusCode: data.statusCode,
        });
      }
    );
  });
};
