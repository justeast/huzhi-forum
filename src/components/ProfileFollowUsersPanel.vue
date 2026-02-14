<script setup>
import { computed, watch, ref } from "vue";
import { message } from "ant-design-vue";
import { PROFILE_FOLLOW_TAB } from "../constants/profileNav";
import {
  fetchFollowerUsers,
  fetchFollowingUsers,
  toggleUserFollow,
} from "../api/user";
import UserFollowList from "./UserFollowList.vue";

const props = defineProps({
  activeKey: { type: String, required: true },
});

const isFollowingTab = computed(
  () => props.activeKey === PROFILE_FOLLOW_TAB.USERS_FOLLOWING,
);

const isFollowersTab = computed(
  () => props.activeKey === PROFILE_FOLLOW_TAB.USERS_FOLLOWERS,
);

const PAGE_SIZE = 20;

const actionLoadingMap = ref({});

const followingList = ref([]);
const followingPage = ref(1);
const followingHasMore = ref(true);
const followingLoading = ref(false);
const followingLoadingMore = ref(false);

const followersList = ref([]);
const followersPage = ref(1);
const followersHasMore = ref(true);
const followersLoading = ref(false);
const followersLoadingMore = ref(false);

const mergeByUserId = (items, incoming) => {
  const map = new Map();
  (items || []).forEach((t) => {
    const id = t?.user?.id;
    if (!id) return;
    map.set(id, t);
  });
  (incoming || []).forEach((t) => {
    const id = t?.user?.id;
    if (!id) return;
    if (!map.has(id)) {
      map.set(id, t);
      return;
    }
    const prev = map.get(id);
    map.set(id, {
      ...prev,
      ...t,
      user: { ...(prev?.user || {}), ...(t?.user || {}) },
    });
  });
  return Array.from(map.values());
};

const fetchFollowing = async ({ reset } = { reset: false }) => {
  if (followingLoading.value || followingLoadingMore.value) return;
  if (!reset && !followingHasMore.value) return;

  if (reset) {
    followingPage.value = 1;
    followingHasMore.value = true;
    followingList.value = [];
    followingLoading.value = true;
  } else {
    followingLoadingMore.value = true;
  }

  const page = reset ? 1 : followingPage.value + 1;

  try {
    const data = await fetchFollowingUsers({ page, size: PAGE_SIZE });
    const results = data?.results || [];
    followingList.value = mergeByUserId(followingList.value, results);
    followingPage.value = page;
    followingHasMore.value = Boolean(data?.next);
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "获取我关注的人失败");
  } finally {
    followingLoading.value = false;
    followingLoadingMore.value = false;
  }
};

const ensureFollowingLoaded = () => {
  if (followingLoading.value) return;
  if (followingList.value.length > 0) return;
  fetchFollowing({ reset: true });
};

const fetchFollowers = async ({ reset } = { reset: false }) => {
  if (followersLoading.value || followersLoadingMore.value) return;
  if (!reset && !followersHasMore.value) return;

  if (reset) {
    followersPage.value = 1;
    followersHasMore.value = true;
    followersList.value = [];
    followersLoading.value = true;
  } else {
    followersLoadingMore.value = true;
  }

  const page = reset ? 1 : followersPage.value + 1;

  try {
    const data = await fetchFollowerUsers({ page, size: PAGE_SIZE });
    const results = data?.results || [];
    followersList.value = mergeByUserId(followersList.value, results);
    followersPage.value = page;
    followersHasMore.value = Boolean(data?.next);
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "获取关注我的人失败");
  } finally {
    followersLoading.value = false;
    followersLoadingMore.value = false;
  }
};

const ensureFollowersLoaded = () => {
  if (followersLoading.value) return;
  if (followersList.value.length > 0) return;
  fetchFollowers({ reset: true });
};

watch(
  () => props.activeKey,
  (key) => {
    if (key === PROFILE_FOLLOW_TAB.USERS_FOLLOWING) {
      ensureFollowingLoaded();
      return;
    }
    if (key === PROFILE_FOLLOW_TAB.USERS_FOLLOWERS) {
      ensureFollowersLoaded();
    }
  },
  { immediate: true },
);

const removeFromFollowing = (userId) => {
  followingList.value = (followingList.value || []).filter(
    (t) => t?.user?.id !== userId,
  );
};

const setFollowersMutual = (userId, isMutual) => {
  followersList.value = (followersList.value || []).map((t) =>
    t?.user?.id === userId ? { ...t, is_mutual: Boolean(isMutual) } : t,
  );
};

const upsertIntoFollowing = (entry) => {
  const userId = entry?.user?.id;
  if (!userId) return;

  const now = new Date().toISOString();
  const nextEntry = {
    ...entry,
    is_mutual: true,
    followed_at: now,
  };

  const exists = (followingList.value || []).some((t) => t?.user?.id === userId);
  if (!exists) {
    followingList.value = [nextEntry, ...(followingList.value || [])];
    return;
  }

  followingList.value = (followingList.value || []).map((t) =>
    t?.user?.id === userId
      ? { ...t, ...nextEntry, user: { ...(t?.user || {}), ...(nextEntry?.user || {}) } }
      : t,
  );
};

const handleToggleFollow = async (entry, action) => {
  const userId = entry?.user?.id;
  if (!userId) return;
  if (actionLoadingMap.value[userId]) return;

  actionLoadingMap.value = { ...actionLoadingMap.value, [userId]: true };

  try {
    await toggleUserFollow(userId, action);

    if (Number(action) === 2) {
      // 取消关注：我关注的人中移除；关注我的人中取消互关标识
      removeFromFollowing(userId);
      setFollowersMutual(userId, false);
      message.success("已取消关注");
      return;
    }

    // 关注：关注我的人中变为互关；我关注的人中插入
    followersList.value = (followersList.value || []).map((t) =>
      t?.user?.id === userId ? { ...t, is_mutual: true } : t,
    );
    upsertIntoFollowing(entry);
    message.success("已关注");
  } catch (error) {
    message.error(error?.message || "操作失败");
  } finally {
    const next = { ...actionLoadingMap.value };
    delete next[userId];
    actionLoadingMap.value = next;
  }
};

const handleClickItem = () => {
  message.info("用户主页功能开发中");
};
</script>

<template>
  <div class="follow-users-panel">
    <UserFollowList
      v-if="isFollowingTab"
      mode="following"
      timePrefix="关注于"
      emptyText="暂无关注的人"
      :items="followingList"
      :loading="followingLoading"
      :loadingMore="followingLoadingMore"
      :hasMore="followingHasMore"
      :actionLoadingMap="actionLoadingMap"
      @load-more="fetchFollowing({ reset: false })"
      @toggle-follow="handleToggleFollow"
      @item-click="handleClickItem"
    />

    <UserFollowList
      v-else-if="isFollowersTab"
      mode="followers"
      timePrefix="Ta关注于"
      emptyText="暂无关注我的人"
      :items="followersList"
      :loading="followersLoading"
      :loadingMore="followersLoadingMore"
      :hasMore="followersHasMore"
      :actionLoadingMap="actionLoadingMap"
      @load-more="fetchFollowers({ reset: false })"
      @toggle-follow="handleToggleFollow"
      @item-click="handleClickItem"
    />
  </div>
</template>

<style scoped>
.follow-users-panel {
  padding: 0;
}
</style>
