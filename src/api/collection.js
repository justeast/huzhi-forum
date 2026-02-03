import { http } from "./http";

// 获取收藏夹列表（GET /collection/）
// 支持分页：page、size
export const fetchCollectionPage = async (paramsOrUrl = {}) => {
  const res =
    typeof paramsOrUrl === "string"
      ? await http.get(paramsOrUrl)
      : await http.get("/collection/", { params: paramsOrUrl });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取收藏夹列表失败");
  }

  return res.data.data;
};

// 自动翻页拉取用户全部收藏夹（根据 data.next 继续请求）
export const fetchAllCollections = async ({ size = 20 } = {}) => {
  const list = [];
  let count = 0;
  let nextUrl = null;
  let page = 1;

  while (true) {
    const data = await fetchCollectionPage(
      nextUrl || {
        page,
        size,
      },
    );

    if (!count) count = Number(data?.count || 0);
    const results = data?.results || [];
    list.push(...results);

    nextUrl = data?.next || null;
    if (!nextUrl) break;

    page += 1;
  }

  return { count, results: list };
};

// 创建收藏夹（POST /collection/）
// payload: { title: string, description?: string, is_public?: boolean }
export const createCollectionFolder = async (payload) => {
  const res = await http.post("/collection/", payload);

  // 文档为 201 Created，兼容部分环境返回 200
  if (![200, 201].includes(Number(res?.status)) || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "创建收藏夹失败");
  }

  return res.data.data;
};

