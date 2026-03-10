import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { message as antdMessage } from "ant-design-vue";
import { useWebSocket } from "@vueuse/core";
import router from "../router";
import { useAuthStore } from "./auth";
import { useNotificationStore } from "./notification";
import { createOrGetChat, fetchChatList, fetchChatMessages, markChatRead } from "../api/chat";
import { fetchUserCard } from "../api/user";

// 将 VITE_API_BASE（http/https）转换为 ws/wss，并拼接 /ws/chat/?token=...
const buildChatWsUrl = (apiBase, accessToken) => {
  const base = String(apiBase || "").trim();
  const token = String(accessToken || "").trim();
  if (!base || !token) return "";

  let url;
  try {
    url = new URL(base);
  } catch {
    return "";
  }

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/chat/";
  url.searchParams.set("token", token);
  return url.toString();
};

const normalizeUserId = (value) => String(value || "").trim();

const safeJsonParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isSameId = (a, b) => normalizeUserId(a) && normalizeUserId(a) === normalizeUserId(b);

export const useChatStore = defineStore("chat", () => {
  const authStore = useAuthStore();
  const notificationStore = useNotificationStore();

  const drawerOpen = ref(false);
  const activeChatId = ref("");

  const chatList = ref([]);
  const chatListLoading = ref(false);
  const chatListLoadingMore = ref(false);
  const chatListPage = ref(1);
  const chatListHasMore = ref(true);

  // chatId -> { items, loading, loaded, error }
  const messageStateMap = ref({});

  // chatId -> { otherUserId, isMutual, sendLimited }
  const chatMetaMap = ref({});

  // 发送中的状态（避免重复提交）
  const sendingText = ref(false);
  const sendingImageCount = ref(0);

  const totalUnread = computed(() =>
    (chatList.value || []).reduce((sum, c) => sum + Math.max(0, Number(c?.unread_count || 0)), 0),
  );

  const wsUrl = computed(() =>
    buildChatWsUrl(import.meta.env.VITE_API_BASE, authStore.accessToken),
  );
  const socketUrl = ref("");

  const closeDrawer = () => {
    drawerOpen.value = false;
  };

  const openDrawer = () => {
    drawerOpen.value = true;
  };

  const ensureMessageState = (chatId) => {
    const id = normalizeUserId(chatId);
    if (!id) return null;
    const map = messageStateMap.value || {};
    if (!map[id]) {
      map[id] = { items: [], loading: false, loaded: false, error: "" };
      messageStateMap.value = { ...map };
    }
    return messageStateMap.value[id];
  };

  const setChatMeta = (chatId, patch) => {
    const id = normalizeUserId(chatId);
    if (!id) return;
    chatMetaMap.value = {
      ...(chatMetaMap.value || {}),
      [id]: { ...(chatMetaMap.value?.[id] || {}), ...(patch || {}) },
    };
  };

  const getChatMeta = (chatId) => chatMetaMap.value?.[normalizeUserId(chatId)] || {};

  const isSendLimited = computed(() => Boolean(getChatMeta(activeChatId.value)?.sendLimited));

  const canSend = computed(() => {
    if (!authStore.isLoggedIn) return false;
    if (!normalizeUserId(activeChatId.value)) return false;
    if (sendingText.value) return false;
    if (sendingImageCount.value > 0) return false;
    if (isSendLimited.value) return false;
    return true;
  });

  // ===================== WebSocket =====================
  const handleWsMessage = async (payload) => {
    const type = payload?.type;
    if (!type) return;

    // 新消息推送：{ type:"new_message", chat_id, message }
    if (type === "new_message") {
      const chatId = normalizeUserId(payload?.chat_id);
      const msg = payload?.message;
      if (!chatId || !msg?.id) return;

      const selfId = normalizeUserId(authStore.userId);
      const senderId = normalizeUserId(msg?.sender?.id);

      // 追加到消息列表（若未加载也先缓存，便于打开后立即展示）
      const state = ensureMessageState(chatId);
      if (state) {
        const exists = (state.items || []).some((m) => String(m?.id) === String(msg.id));
        if (!exists) {
          state.items = [...(state.items || []), msg];
        }
        state.loaded = true;
        state.error = "";
      }

      // 更新会话列表：last_message/unread_count/排序
      upsertChatFromWs(chatId, msg);

      // 收到对方消息：解除“非互关仅一条”的本地限制
      if (senderId && selfId && senderId !== selfId) {
        setChatMeta(chatId, { sendLimited: false });
      }

      // 无论消息来自谁，都尝试重新计算一次“发送限制”
      // - 非互关：我发出第一条后就应立即进入限制态，避免继续发送/继续上传图片造成浪费
      // - 互关：recompute 会强制保持为 false
      // 注意：recomputeSendLimited 在文件后方声明，这里用 microtask 延后执行，
      // 避免极端情况下 WS 回包早于 store 初始化完成导致的 TDZ 问题
      queueMicrotask(() => {
        try {
          recomputeSendLimited(chatId);
        } catch {
          // 忽略
        }
      });

      // 当前正在看的会话：标记已读并清理未读
      if (drawerOpen.value && isSameId(activeChatId.value, chatId) && senderId !== selfId) {
        await markReadSilently(chatId);
      }
      return;
    }

    if (type === "notification") {
      notificationStore.receiveWsNotification(payload?.notification);
      return;
    }

    // 错误：{ type:"error", code, message }
    if (type === "error") {
      const code = Number(payload?.code || 0);
      const msg = String(payload?.message || "").trim() || "发送失败";

      // 80008：非互关对方回复前仅可发送一条消息
      // 优先使用服务端回包的 chat_id，避免“发送消息时切换会话”导致误标记
      const targetChatId = normalizeUserId(payload?.chat_id || activeChatId.value);
      if (code === 80008 && targetChatId) {
        // 立即移除“互关”展示，避免 UI 与服务端限制冲突
        setChatMeta(targetChatId, { sendLimited: true, isMutual: false });
        // 80008 往往意味着互关已失效：强制刷新互关状态，避免仍显示“互关”
        await ensureChatMetaLoadedWithOptions(targetChatId, { force: true });
        recomputeSendLimited(targetChatId);
      }

      antdMessage.error(msg);
      return;
    }
  };

  const activeWsUrl = ref("");
  let wsSyncTask = Promise.resolve();

  const {
    status: wsStatus,
    send: wsSend,
    open: wsOpen,
    close: wsClose,
    ws: wsRef,
  } = useWebSocket(socketUrl, {
    immediate: false,
    autoConnect: false,
    autoReconnect: {
      retries: Infinity,
      delay: 1200,
    },
    onMessage: (_ws, event) => {
      const payload = safeJsonParse(event?.data);
      if (!payload) return;
      handleWsMessage(payload);
    },
    onDisconnected: (_ws, event) => {
      // 连接断开后，清空当前已同步的目标地址，便于后续重新建立连接
      activeWsUrl.value = "";

      // 4001：token 缺失/无效（后端 consumers.py）
      if (Number(event?.code) === 4001 && authStore.isLoggedIn) {
        try {
          authStore.logout();
          router.replace("/auth");
          antdMessage.warning("登录已过期，请重新登录");
        } catch {
          // 忽略
        }
      }
    },
  });

  const connectWsIfNeeded = async (targetUrl = wsUrl.value) => {
    const nextUrl = String(targetUrl || "").trim();
    if (!authStore.isLoggedIn) return;
    if (!nextUrl) return;
    if (activeWsUrl.value === nextUrl) {
      if (wsStatus.value === "OPEN" || wsStatus.value === "CONNECTING") return;
    }

    if (socketUrl.value !== nextUrl) {
      socketUrl.value = nextUrl;
    }
    activeWsUrl.value = nextUrl;
    try {
      await wsOpen();
    } catch {
      // 连接失败时交给 autoReconnect
    }
  };

  const closeWsIfNeeded = async () => {
    if (wsStatus.value === "CLOSED" || wsStatus.value === "CLOSING") {
      activeWsUrl.value = "";
      socketUrl.value = "";
      return;
    }
    try {
      await wsClose();
    } catch {
      // ignore
    } finally {
      activeWsUrl.value = "";
      socketUrl.value = "";
    }
  };

  const enqueueWsSync = (runner) => {
    const task = wsSyncTask.finally(runner);
    wsSyncTask = task.catch(() => {});
    return task;
  };

  const syncWsState = async () =>
    enqueueWsSync(async () => {
      const desiredUrl = authStore.isLoggedIn ? String(wsUrl.value || "").trim() : "";

      if (!desiredUrl) {
        await closeWsIfNeeded();
        return;
      }

      if (activeWsUrl.value && activeWsUrl.value !== desiredUrl) {
        await closeWsIfNeeded();
      }

      await connectWsIfNeeded(desiredUrl);
    });

  const resetChatState = () => {
    drawerOpen.value = false;
    activeChatId.value = "";
    chatList.value = [];
    chatListPage.value = 1;
    chatListHasMore.value = true;
    messageStateMap.value = {};
    chatMetaMap.value = {};
  };

  watch(
    () => [authStore.isLoggedIn, wsUrl.value].join("|"),
    async () => {
      const loggedIn = authStore.isLoggedIn;
      await syncWsState();

      if (loggedIn) {
        // 预加载会话列表：用于导航栏未读 badge，避免必须打开抽屉才看到未读
        // 注意：loadChatList 在文件后方声明，这里用 microtask 延后执行以避免 TDZ
        queueMicrotask(() => {
          try {
            loadChatList();
          } catch {
            // 忽略
          }
        });
        return;
      }

      // 退出登录：清理所有私信状态
      resetChatState();
    },
    { immediate: true },
  );

  // ===================== 会话列表 =====================
  const applyChatListPage = (pageData, { append } = {}) => {
    const results = pageData?.results || [];
    const next = pageData?.next;

    if (append) {
      const merged = [...(chatList.value || [])];
      for (const item of results) {
        const id = normalizeUserId(item?.id);
        if (!id) continue;
        const idx = merged.findIndex((c) => isSameId(c?.id, id));
        if (idx >= 0) merged[idx] = { ...merged[idx], ...item };
        else merged.push(item);
      }
      chatList.value = merged;
    } else {
      chatList.value = results;
    }

    chatListHasMore.value = Boolean(next);
  };

  const loadChatList = async ({ refresh } = {}) => {
    if (!authStore.isLoggedIn) return;
    if (chatListLoading.value) return;

    chatListLoading.value = true;
    try {
      chatListPage.value = 1;
      const data = await fetchChatList({ page: 1, size: 20 });
      applyChatListPage(data, { append: false });
      if (refresh && activeChatId.value) {
        // 刷新后可能会话对象变了，确保 activeChatId 仍存在
        const exists = (chatList.value || []).some((c) => isSameId(c?.id, activeChatId.value));
        if (!exists) activeChatId.value = "";
      }
    } catch (error) {
      if (error?.__handled401 || error?.response?.status === 401) return;
      antdMessage.error(error?.message || "获取会话列表失败");
    } finally {
      chatListLoading.value = false;
    }
  };

  const loadMoreChatList = async () => {
    if (!authStore.isLoggedIn) return;
    if (chatListLoading.value || chatListLoadingMore.value) return;
    if (!chatListHasMore.value) return;

    chatListLoadingMore.value = true;
    try {
      const nextPage = Math.max(1, Number(chatListPage.value || 1) + 1);
      const data = await fetchChatList({ page: nextPage, size: 20 });
      chatListPage.value = nextPage;
      applyChatListPage(data, { append: true });
    } catch (error) {
      if (error?.__handled401 || error?.response?.status === 401) return;
      antdMessage.error(error?.message || "加载更多失败");
    } finally {
      chatListLoadingMore.value = false;
    }
  };

  const findChat = (chatId) =>
    (chatList.value || []).find((c) => isSameId(c?.id, normalizeUserId(chatId)));

  const upsertChat = (chat) => {
    const id = normalizeUserId(chat?.id);
    if (!id) return;
    const list = [...(chatList.value || [])];
    const idx = list.findIndex((c) => isSameId(c?.id, id));
    if (idx >= 0) list[idx] = { ...list[idx], ...chat };
    else list.unshift(chat);
    chatList.value = list;
  };

  const bumpChatToTop = (chatId) => {
    const id = normalizeUserId(chatId);
    if (!id) return;
    const list = [...(chatList.value || [])];
    const idx = list.findIndex((c) => isSameId(c?.id, id));
    if (idx < 0) return;
    const [item] = list.splice(idx, 1);
    list.unshift(item);
    chatList.value = list;
  };

  const upsertChatFromWs = (chatId, msg) => {
    const id = normalizeUserId(chatId);
    if (!id) return;

    const selfId = normalizeUserId(authStore.userId);
    const senderId = normalizeUserId(msg?.sender?.id);

    const existing = findChat(id);
    if (!existing) {
      // 会话不存在时，拉一次列表同步（避免缺失 other_user）
      loadChatList();
      return;
    }

    const lastMessage = {
      content: msg?.content,
      msg_type: msg?.msg_type,
      created: msg?.created,
      is_mine: senderId && selfId ? senderId === selfId : false,
    };

    const unread =
      senderId && selfId && senderId !== selfId && !isSameId(activeChatId.value, id)
        ? Math.max(0, Number(existing?.unread_count || 0) + 1)
        : Math.max(0, Number(existing?.unread_count || 0));

    upsertChat({
      ...existing,
      last_message: lastMessage,
      unread_count: unread,
      modified: msg?.modified || existing?.modified,
    });
    bumpChatToTop(id);
  };

  const markReadSilently = async (chatId) => {
    const id = normalizeUserId(chatId);
    if (!id) return;
    try {
      await markChatRead(id, []);
    } catch {
      // ignore
    }
    // 本地清理未读
    const existing = findChat(id);
    if (existing) {
      upsertChat({ ...existing, unread_count: 0 });
    }
  };

  // ===================== 打开会话 =====================
  const normalizeOtherUserFromChatDetail = (detail) => {
    const selfId = normalizeUserId(authStore.userId);
    const u1 = detail?.user1;
    const u2 = detail?.user2;
    if (!selfId) return null;
    if (normalizeUserId(u1?.id) && normalizeUserId(u1?.id) !== selfId) return u1;
    if (normalizeUserId(u2?.id) && normalizeUserId(u2?.id) !== selfId) return u2;
    return null;
  };

  const ensureChatMetaLoaded = async (chatId) => {
    await ensureChatMetaLoadedWithOptions(chatId, { force: false });
  };

  const ensureChatMetaLoadedWithOptions = async (chatId, { force } = {}) => {
    const id = normalizeUserId(chatId);
    if (!id) return;

    const chat = findChat(id);
    const otherId = normalizeUserId(chat?.other_user?.id);
    if (!otherId) return;

    const current = getChatMeta(id);
    if (!force && current?.otherUserId && current?.isMutual !== undefined) return;

    try {
      const card = await fetchUserCard(otherId);
      setChatMeta(id, {
        otherUserId: otherId,
        isMutual: Boolean(card?.is_mutual),
      });
    } catch {
      setChatMeta(id, { otherUserId: otherId });
    }
  };

  const recomputeSendLimited = (chatId) => {
    const id = normalizeUserId(chatId);
    if (!id) return;

    const meta = getChatMeta(id);
    if (meta?.isMutual) {
      setChatMeta(id, { sendLimited: false });
      return;
    }
    // 未拿到 isMutual 前，不做“限制态”推断，避免互关用户被误判为受限
    if (meta?.isMutual === undefined) return;

    const selfId = normalizeUserId(authStore.userId);
    const otherId = normalizeUserId(findChat(id)?.other_user?.id || meta?.otherUserId);
    const items = messageStateMap.value?.[id]?.items || [];

    const selfHas = items.some((m) => normalizeUserId(m?.sender?.id) === selfId);
    const otherHas = otherId ? items.some((m) => normalizeUserId(m?.sender?.id) === otherId) : false;

    // 非互关：对方回复前，仅允许我发送一条
    setChatMeta(id, { sendLimited: Boolean(selfHas && !otherHas) });
  };

  const isSendLimitedForChat = (chatId) => Boolean(getChatMeta(chatId)?.sendLimited);

  const openChatById = async (chatId) => {
    const id = normalizeUserId(chatId);
    if (!id) return;

    openDrawer();
    activeChatId.value = id;

    await connectWsIfNeeded();

    // 确保会话列表已加载（用于展示 other_user）
    if ((chatList.value || []).length === 0) {
      await loadChatList();
    }

    // 先加载消息，再计算限制，再标记已读
    await loadMessages(id);
    // 进入会话时强制刷新一次互关状态，避免互关变化导致 UI 与服务端限制不一致
    await ensureChatMetaLoadedWithOptions(id, { force: true });
    recomputeSendLimited(id);
    await markReadSilently(id);
  };

  const openChatWithUser = async (userId) => {
    const uid = normalizeUserId(userId);
    if (!uid) return;
    if (!authStore.isLoggedIn) {
      router.replace("/auth");
      antdMessage.warning("请先登录");
      return;
    }
    if (uid === normalizeUserId(authStore.userId)) return;

    try {
      const detail = await createOrGetChat(uid);
      const chatId = normalizeUserId(detail?.id);
      if (!chatId) throw new Error("创建会话失败");

      // 将会话写入列表（确保立即可见）
      const other = normalizeOtherUserFromChatDetail(detail);
      upsertChat({
        id: chatId,
        other_user: other || { id: uid, username: "用户" },
        last_message: null,
        unread_count: 0,
        created: detail?.created,
        modified: detail?.modified,
      });

      await openChatById(chatId);
    } catch (error) {
      if (error?.__handled401 || error?.response?.status === 401) return;
      antdMessage.error(error?.message || "打开会话失败");
    }
  };

  // ===================== 历史消息 =====================
  const loadMessages = async (chatId) => {
    const id = normalizeUserId(chatId);
    if (!id) return;
    const state = ensureMessageState(id);
    if (!state) return;
    if (state.loading) return;

    state.loading = true;
    state.error = "";
    try {
      // 受后端限制，当前接口最多返回最近 50 条；这里直接一次拿满，简化分页逻辑
      const data = await fetchChatMessages(id, { page: 1, size: 50 });
      const results = data?.results || [];
      state.items = results;
      state.loaded = true;
    } catch (error) {
      if (error?.__handled401 || error?.response?.status === 401) return;
      state.error = error?.message || "获取消息失败";
    } finally {
      state.loading = false;
    }
  };

  // ===================== 已读 =====================
  const markAllChatsRead = async () => {
    if (!authStore.isLoggedIn) return;

    // 确保列表存在（未打开抽屉时也允许一键已读）
    if ((chatList.value || []).length === 0) {
      await loadChatList();
    }

    const targets = (chatList.value || []).filter((c) => Number(c?.unread_count || 0) > 0);
    if (targets.length === 0) return;

    for (const c of targets) {
      const id = normalizeUserId(c?.id);
      if (!id) continue;
      await markReadSilently(id);
    }
  };

  // ===================== 发送 =====================
  const sendTextMessage = async (text, chatIdOverride) => {
    const chatId = normalizeUserId(chatIdOverride || activeChatId.value);
    const content = String(text || "").trim();
    if (!chatId || !content) return;
    if (!authStore.isLoggedIn) return;

    if (isSendLimitedForChat(chatId)) {
      antdMessage.warning("等待对方回复后可继续发送");
      return;
    }

    sendingText.value = true;
    try {
      await connectWsIfNeeded();
      const payload = {
        type: "send_message",
        chat_id: chatId,
        content,
        msg_type: 1,
      };
      wsSend(JSON.stringify(payload));
    } finally {
      sendingText.value = false;
    }
  };

  const sendImageMessage = async (imageUrl, chatIdOverride) => {
    const chatId = normalizeUserId(chatIdOverride || activeChatId.value);
    const url = String(imageUrl || "").trim();
    if (!chatId || !url) return;
    if (!authStore.isLoggedIn) return;

    if (isSendLimitedForChat(chatId)) {
      antdMessage.warning("等待对方回复后可继续发送");
      return;
    }

    try {
      await connectWsIfNeeded();
      const payload = {
        type: "send_message",
        chat_id: chatId,
        content: url,
        msg_type: 2,
      };
      wsSend(JSON.stringify(payload));
    } catch {
      // 发送失败由服务端 error 回包处理，这里不额外提示
    }
  };

  const setSendingImages = (delta) => {
    sendingImageCount.value = Math.max(0, Number(sendingImageCount.value || 0) + Number(delta || 0));
  };

  return {
    // state
    drawerOpen,
    activeChatId,
    chatList,
    chatListLoading,
    chatListLoadingMore,
    chatListHasMore,
    wsStatus,
    totalUnread,
    messageStateMap,
    chatMetaMap,
    sendingText,
    sendingImageCount,
    isSendLimited,
    canSend,

    // actions
    openDrawer,
    closeDrawer,
    loadChatList,
    loadMoreChatList,
    openChatById,
    openChatWithUser,
    loadMessages,
    markReadSilently,
    markAllChatsRead,
    sendTextMessage,
    sendImageMessage,
    setSendingImages,
    recomputeSendLimited,
    ensureChatMetaLoaded,
    ensureChatMetaLoadedWithOptions,

    // debug
    wsRef,
  };
});
