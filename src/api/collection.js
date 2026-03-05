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

// 获取“包含指定回答”的收藏夹列表（GET /collection/?answer={answer_id}）
// 自动翻页拉全量，返回结构同 fetchAllCollections
export const fetchAllCollectionsContainingAnswer = async (
  answerId,
  { size = 20 } = {},
) => {
  if (!answerId) throw new Error("缺少回答ID");

  const list = [];
  let count = 0;
  let nextUrl = null;
  let page = 1;

  while (true) {
    const data = await fetchCollectionPage(
      nextUrl || {
        page,
        size,
        answer: answerId,
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

// 收藏/取消收藏回答（POST /collection/{collection_id}/collect_answer/）
// toggle 操作：同一收藏夹再次调用会取消收藏
export const toggleCollectAnswer = async (collectionId, answerId) => {
  if (!collectionId) throw new Error("收藏夹 id 不能为空");
  if (!answerId) throw new Error("缺少回答ID");

  const res = await http.post(`/collection/${collectionId}/collect_answer/`, {
    answer_id: answerId,
  });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "操作失败");
  }

  return res.data.data;
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

// 修改收藏夹（PATCH /collection/{collection_id}/）
// payload: { title?: string, description?: string, is_public?: boolean }
export const updateCollectionFolder = async (collectionId, payload) => {
  if (!collectionId) throw new Error("收藏夹 id 不能为空");

  const res = await http.patch(`/collection/${collectionId}/`, payload);

  if (Number(res?.status) !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "修改收藏夹失败");
  }

  return res.data.data;
};

// 删除收藏夹（DELETE /collection/{collection_id}/）
export const deleteCollectionFolder = async (collectionId) => {
  if (!collectionId) throw new Error("收藏夹 id 不能为空");

  const res = await http.delete(`/collection/${collectionId}/`);

  // 文档为 204 No Content（无响应体），兼容部分环境返回 200/响应体
  if (Number(res?.status) === 204) return;

  if (Number(res?.status) !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "删除收藏夹失败");
  }
};

// 获取收藏夹内回答列表（GET /collection/{collection_id}/answers/）
// 支持分页：page、size；也支持直接传入 nextUrl（完整 URL）
export const fetchCollectionAnswerPage = async (
  collectionId,
  paramsOrUrl = {},
) => {
  if (!collectionId) throw new Error("收藏夹 id 不能为空");

  const res =
    typeof paramsOrUrl === "string"
      ? await http.get(paramsOrUrl)
      : await http.get(`/collection/${collectionId}/answers/`, {
          params: {
            page: paramsOrUrl.page || 1,
            size: paramsOrUrl.size || 10,
          },
        });

  if (res?.status !== 200 || res?.data?.code !== 1) {
    throw new Error(res?.data?.msg || "获取收藏夹内容失败");
  }

  return res.data.data;
};
