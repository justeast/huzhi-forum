<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { formatDateTimeMinute } from "../utils/format";

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  emptyText: { type: String, default: "暂无数据" },
  timePrefix: { type: String, default: "关注于" },
  mode: { type: String, default: "following" }, // following | followers
  actionLoadingMap: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["load-more", "toggle-follow", "item-click"]);

const sentinelRef = ref(null);
let observer = null;

const showEmpty = computed(() => !props.loading && props.items.length === 0);

const canLoadMore = computed(
  () => props.hasMore && !props.loading && !props.loadingMore,
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

const isMutual = (item) => Boolean(item?.is_mutual);

const getAction = (item) => {
  const mutual = isMutual(item);
  if (props.mode === "following") return { action: 2, label: "取消关注" };
  // followers
  return mutual ? { action: 2, label: "取消关注" } : { action: 1, label: "关注" };
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
              <div class="name">{{ item?.user?.username }}</div>
              <div class="bio">
                {{ getBio(item) || "暂无简介" }}
              </div>
            </div>
          </div>

          <div class="right">
            <div class="time">
              {{ timePrefix }} {{ formatDateTimeMinute(item?.followed_at) }}
            </div>

            <div class="op-slot">
              <span v-if="isMutual(item)" class="mutual-badge">
                <img class="mutual-icon" src="/mutual-follow.svg" alt="互关" />
                <span>已互关</span>
              </span>

              <button
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

.name {
  font-size: 18px;
  font-weight: 900;
  color: #111827;
  line-height: 1.2;
  transition: color 0.18s ease;
}

.row:hover .name {
  color: var(--brand-color);
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
