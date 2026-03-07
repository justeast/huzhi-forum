<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { formatDateTimeMinute } from "../utils/format";

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  emptyText: { type: String, default: "暂无数据" },
  // 是否显示时间行（他人主页的“Ta关注的人”不需要展示关注时间）
  showTime: { type: Boolean, default: true },
  timePrefix: { type: String, default: "关注于" },
  // following: 我关注的人；followers: 关注我的人；others: Ta关注的人（对非我用户提供关注操作）
  mode: { type: String, default: "following" }, // following | followers | others
  actionLoadingMap: { type: Object, default: () => ({}) },
  // 是否显示“关注/取消关注”等操作按钮（他人主页展示 Ta 关注的人时可隐藏）
  showAction: { type: Boolean, default: true },
  // 当前登录用户 id：用于在列表里遇到“我自己”时隐藏关注按钮
  selfUserId: { type: String, default: "" },
});

const emit = defineEmits(["load-more", "toggle-follow", "item-click"]);

const sentinelRef = ref(null);
let observer = null;

const showEmpty = computed(() => !props.loading && props.items.length === 0);

const canLoadMore = computed(
  // 列表为空时不触发自动 load-more，避免“首屏未加载就先翻页”的请求
  () =>
    props.items.length > 0 && props.hasMore && !props.loading && !props.loadingMore,
);

const observeSentinel = () => {
  if (!sentinelRef.value) return;
  if (observer) observer.disconnect();

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries?.[0];
      if (!entry?.isIntersecting) return;
      if (!canLoadMore.value) return;
      emit("load-more");
    },
    {
      root: null,
      rootMargin: "240px 0px 240px 0px",
      threshold: 0,
    },
  );

  observer.observe(sentinelRef.value);
};

onMounted(() => {
  observeSentinel();
});

onBeforeUnmount(() => {
  if (observer) observer.disconnect();
  observer = null;
});

const getAvatar = (item) => item?.user?.avatar || "/default-avatar.png";

const handleAvatarError = (event) => {
  const el = event?.target;
  if (!el || el.dataset?.fallbackApplied) return;
  el.dataset.fallbackApplied = "1";
  el.src = "/default-avatar.png";
};

const getBio = (item) => {
  const bio = item?.user?.bio;
  if (bio === null || bio === undefined) return "";
  return String(bio || "").trim();
};

const isMutual = (item) =>
  // 不同列表接口返回字段位置可能不同（有的在根上，有的在 user 上）
  Boolean(item?.is_mutual ?? item?.user?.is_mutual);

const isFollowingByMe = (item) =>
  // 后端部分列表接口可能不返回 is_following（例如 Ta 关注的人列表），但会返回 is_mutual
  // 互关意味着“我已关注 Ta”，因此可用 is_mutual 兜底判断按钮文案/动作
  Boolean(
    item?.is_following ??
      item?.user?.is_following ??
      item?.is_mutual ??
      item?.user?.is_mutual,
  );

const getAction = (item) => {
  const mutual = isMutual(item);
  if (props.mode === "following") return { action: 2, label: "取消关注" };
  if (props.mode === "followers") {
    return mutual ? { action: 2, label: "取消关注" } : { action: 1, label: "关注" };
  }
  // others：基于“当前登录用户视角”的 is_following 做切换
  return isFollowingByMe(item) ? { action: 2, label: "取消关注" } : { action: 1, label: "关注" };
};

const handleToggle = (item) => {
  const id = item?.user?.id;
  if (!id) return;
  const { action } = getAction(item);
  emit("toggle-follow", item, action);
};

const handleClickItem = (item) => {
  emit("item-click", item);
};

const isSelfRow = (item) => {
  const uid = String(item?.user?.id || "").trim();
  const self = String(props.selfUserId || "").trim();
  if (!uid || !self) return false;
  return uid === self;
};
</script>

<template>
  <div class="user-follow-list">
    <a-spin :spinning="loading">
      <a-empty v-if="showEmpty" :description="emptyText" />

      <TransitionGroup v-else tag="div" name="follow" class="list">
        <div
          v-for="item in items"
          :key="item?.user?.id || item?.user?.username"
          class="row"
          role="button"
          tabindex="0"
          @click="handleClickItem(item)"
        >
          <div class="left">
            <div class="avatar-wrap">
              <img
                class="avatar"
                :src="getAvatar(item)"
                :alt="item?.user?.username || '用户头像'"
                @error="handleAvatarError"
              />
            </div>

            <div class="info">
              <div class="name-row">
                <div class="name">{{ item?.user?.username }}</div>
                <span v-if="isSelfRow(item)" class="self-badge">我</span>
              </div>
              <div class="bio">
                {{ getBio(item) || "暂无简介" }}
              </div>
            </div>
          </div>

          <div
            class="right"
            :class="{ compact: !showAction, 'no-time': !showTime }"
          >
            <div v-if="showTime" class="time">
              {{ timePrefix }} {{ formatDateTimeMinute(item?.followed_at) }}
            </div>

            <div v-if="showAction" class="op-slot">
              <span v-if="isMutual(item)" class="mutual-badge">
                <img class="mutual-icon" src="/mutual-follow.svg" alt="互关" />
                <span>已互关</span>
              </span>

              <button
                v-if="!isSelfRow(item)"
                class="op-btn"
                type="button"
                :class="{ danger: getAction(item).action === 2 }"
                :disabled="Boolean(actionLoadingMap?.[item?.user?.id])"
                @click.stop="handleToggle(item)"
              >
                <template v-if="actionLoadingMap?.[item?.user?.id]">处理中</template>
                <template v-else>{{ getAction(item).label }}</template>
              </button>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <div ref="sentinelRef" class="sentinel" aria-hidden="true"></div>

      <div v-if="loadingMore" class="more">
        <a-spin size="small" />
        <span class="more-text">加载中...</span>
      </div>

      <div v-else-if="items.length > 0 && !hasMore" class="more done">
        <span class="more-text">没有更多了</span>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.user-follow-list {
  padding: 0;
}

.list {
  padding: 0;
}

.row {
  padding: 18px 18px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.row + .row {
  border-top: 1px solid #f0f2f5;
}

.row:hover {
  background: rgba(120, 200, 65, 0.06);
}

.left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex: 1;
}

.avatar-wrap {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  overflow: hidden;
  background: #f1f5f9;
  flex: none;
}

.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.info {
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.name {
  font-size: 18px;
  font-weight: 900;
  color: #111827;
  line-height: 1.2;
  transition: color 0.18s ease;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row:hover .name {
  color: var(--brand-color);
}

.self-badge {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(120, 200, 65, 0.22);
  background: rgba(120, 200, 65, 0.12);
  color: var(--brand-color);
  font-weight: 900;
  font-size: 12px;
  line-height: 1.2;
}

.bio {
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.right {
  --time-width: 260px;
  --op-width: 110px;
  flex: none;
  width: calc(var(--time-width) + var(--op-width) + 14px);
  display: grid;
  grid-template-columns: var(--time-width) var(--op-width);
  align-items: center;
  gap: 14px;
}

.right.no-time {
  width: var(--op-width);
  grid-template-columns: 1fr;
}

.right.compact {
  width: auto;
  grid-template-columns: 1fr;
}

.time {
  color: #94a3b8;
  font-weight: 700;
  font-size: 13px;
  white-space: nowrap;
  text-align: right;
}

.op-slot {
  position: relative;
  width: var(--op-width);
  height: 30px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.mutual-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-weight: 900;
  font-size: 11px;
  white-space: nowrap;
  gap: 5px;
  height: 26px;
  position: absolute;
  right: 0;
  top: 50%;
  transform: translate(0, -50%);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.mutual-icon {
  width: 12px;
  height: 12px;
  display: block;
  opacity: 0.92;
}

.op-btn {
  position: absolute;
  right: 0;
  top: 0;
  height: 30px;
  width: var(--op-width);
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--brand-color);
  background: #fff;
  color: var(--brand-color);
  font-weight: 900;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  opacity: 0;
  transform: translateX(6px);
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.row:hover .op-btn {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.row:hover .mutual-badge {
  opacity: 0;
  transform: translate(6px, -50%);
  pointer-events: none;
}

.op-btn:hover {
  background: rgba(120, 200, 65, 0.1);
}

.op-btn.danger {
  border-color: #e2e8f0;
  background: #f1f5f9;
  color: #64748b;
}

.row:hover .op-btn.danger:hover {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.op-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  pointer-events: none;
}

.sentinel {
  height: 1px;
}

.more {
  margin: 14px 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #94a3b8;
  font-size: 13px;
}

.more.done {
  padding-bottom: 8px;
}

.follow-move,
.follow-enter-active,
.follow-leave-active {
  transition: all 0.28s ease;
}

.follow-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.follow-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

.follow-leave-active {
  position: relative;
}
</style>
