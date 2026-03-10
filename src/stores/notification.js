import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import {
  fetchNotificationPage,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notification";

const normalizeId = (value) => String(value || "").trim();

export const useNotificationStore = defineStore("notification", () => {
  const authStore = useAuthStore();

  const drawerOpen = ref(false);
  const notificationList = ref([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const hasMore = ref(true);
  const page = ref(1);
  const unreadCount = ref(0);
  const unreadLoading = ref(false);
  const markLoadingMap = ref({});
  const markingAll = ref(false);

  const resetState = () => {
    drawerOpen.value = false;
    notificationList.value = [];
    loading.value = false;
    loadingMore.value = false;
    hasMore.value = true;
    page.value = 1;
    unreadCount.value = 0;
    unreadLoading.value = false;
    markLoadingMap.value = {};
    markingAll.value = false;
  };

  const openDrawer = () => {
    drawerOpen.value = true;
  };

  const closeDrawer = () => {
    drawerOpen.value = false;
  };

  const patchNotification = (notificationId, patch = {}) => {
    const id = normalizeId(notificationId);
    if (!id) return null;

    const list = [...(notificationList.value || [])];
    const index = list.findIndex((item) => normalizeId(item?.id) === id);
    if (index < 0) return null;

    list[index] = { ...list[index], ...(patch || {}) };
    notificationList.value = list;
    return list[index];
  };

  const upsertNotification = (notification, { prepend = true } = {}) => {
    const id = normalizeId(notification?.id);
    if (!id) return null;

    const list = [...(notificationList.value || [])];
    const index = list.findIndex((item) => normalizeId(item?.id) === id);

    if (index >= 0) {
      list[index] = { ...list[index], ...(notification || {}) };
      if (prepend && index > 0) {
        const [current] = list.splice(index, 1);
        list.unshift(current);
      }
      notificationList.value = list;
      return list[prepend && index > 0 ? 0 : index];
    }

    if (prepend) list.unshift(notification);
    else list.push(notification);
    notificationList.value = list;
    return notification;
  };

  const applyNotificationPage = (pageData, { append } = {}) => {
    const results = pageData?.results || [];
    const next = pageData?.next;

    if (append) {
      const merged = [...(notificationList.value || [])];
      for (const item of results) {
        const id = normalizeId(item?.id);
        if (!id) continue;
        const index = merged.findIndex((entry) => normalizeId(entry?.id) === id);
        if (index >= 0) merged[index] = { ...merged[index], ...item };
        else merged.push(item);
      }
      notificationList.value = merged;
    } else {
      notificationList.value = results;
    }

    hasMore.value = Boolean(next);
  };

  const refreshUnreadCount = async () => {
    if (!authStore.isLoggedIn) {
      unreadCount.value = 0;
      return 0;
    }
    if (unreadLoading.value) return unreadCount.value;

    unreadLoading.value = true;
    try {
      const data = await fetchUnreadNotificationCount();
      unreadCount.value = Math.max(0, Number(data?.unread_count || 0));
      return unreadCount.value;
    } finally {
      unreadLoading.value = false;
    }
  };

  const loadNotificationList = async ({ refresh } = {}) => {
    if (!authStore.isLoggedIn) return;
    if (loading.value) return;

    loading.value = true;
    try {
      page.value = 1;
      const data = await fetchNotificationPage({ page: 1, size: 20 });
      applyNotificationPage(data, { append: false });
      if (refresh) {
        await refreshUnreadCount();
      }
    } finally {
      loading.value = false;
    }
  };

  const loadMoreNotificationList = async () => {
    if (!authStore.isLoggedIn) return;
    if (loading.value || loadingMore.value) return;
    if (!hasMore.value) return;

    loadingMore.value = true;
    try {
      const nextPage = Math.max(1, Number(page.value || 1) + 1);
      const data = await fetchNotificationPage({ page: nextPage, size: 20 });
      page.value = nextPage;
      applyNotificationPage(data, { append: true });
    } finally {
      loadingMore.value = false;
    }
  };

  const markOneRead = async (notificationId) => {
    const id = normalizeId(notificationId);
    if (!id) return null;
    if (markLoadingMap.value?.[id]) return null;

    const current = (notificationList.value || []).find(
      (item) => normalizeId(item?.id) === id,
    );
    if (current?.is_read) return current;

    markLoadingMap.value = { ...(markLoadingMap.value || {}), [id]: true };
    try {
      const data = await markNotificationRead(id);
      const updated = patchNotification(id, data) || upsertNotification(data, { prepend: false });
      unreadCount.value = Math.max(0, Number(unreadCount.value || 0) - 1);
      return updated;
    } finally {
      const next = { ...(markLoadingMap.value || {}) };
      delete next[id];
      markLoadingMap.value = next;
    }
  };

  const markAllRead = async () => {
    if (!authStore.isLoggedIn) return;
    if (markingAll.value) return;
    if (Number(unreadCount.value || 0) <= 0) return;

    markingAll.value = true;
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      notificationList.value = (notificationList.value || []).map((item) =>
        item?.is_read
          ? item
          : {
              ...item,
              is_read: true,
              read_at: item?.read_at || now,
            },
      );
      unreadCount.value = 0;
    } finally {
      markingAll.value = false;
    }
  };

  const receiveWsNotification = (notification) => {
    const id = normalizeId(notification?.id);
    if (!id) return;

    const existing = (notificationList.value || []).find(
      (item) => normalizeId(item?.id) === id,
    );
    upsertNotification(notification, { prepend: true });

    if (!notification?.is_read && existing?.is_read !== false) {
      unreadCount.value = Math.max(0, Number(unreadCount.value || 0) + 1);
    }
  };

  watch(
    () => authStore.isLoggedIn,
    async (loggedIn) => {
      if (loggedIn) {
        try {
          await refreshUnreadCount();
        } catch {
          // 忽略
        }
        return;
      }
      resetState();
    },
    { immediate: true },
  );

  return {
    drawerOpen,
    notificationList,
    loading,
    loadingMore,
    hasMore,
    page,
    unreadCount,
    unreadLoading,
    markLoadingMap,
    markingAll,
    openDrawer,
    closeDrawer,
    refreshUnreadCount,
    loadNotificationList,
    loadMoreNotificationList,
    markOneRead,
    markAllRead,
    receiveWsNotification,
    resetState,
  };
});
