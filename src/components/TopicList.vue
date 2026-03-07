<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { formatCount } from "../utils/format";

const props = defineProps({
  topics: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  emptyText: { type: String, default: "暂无话题" },
  followLoadingMap: { type: Object, default: () => ({}) },
  // 是否显示“关注/已关注”按钮（他人主页里展示 Ta 关注的话题时建议隐藏）
  showFollowButton: { type: Boolean, default: true },
  // 取消关注后的表现：toggle=仅切换按钮；remove=父组件移除后可配合 TransitionGroup 做擦除动画
  unfollowBehavior: { type: String, default: "toggle" },
  // 话题卡片是否可点击进入详情
  clickable: { type: Boolean, default: true },
});

const emit = defineEmits(["load-more", "toggle-follow", "item-click"]);

const sentinelRef = ref(null);
let observer = null;

const showEmpty = computed(() => !props.loading && props.topics.length === 0);

const canLoadMore = computed(
  // 列表为空时不触发自动 load-more，避免“首屏未加载就先翻页”的请求
  () =>
    props.topics.length > 0 &&
    props.hasMore &&
    !props.loading &&
    !props.loadingMore,
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

const getIcon = (topic) => topic?.icon || "/default-topic.svg";

const handleIconError = (event) => {
  const el = event?.target;
  if (!el || el.dataset?.fallbackApplied) return;
  el.dataset.fallbackApplied = "1";
  el.src = "/default-topic.svg";
};

const handleToggleFollow = (topic) => {
  emit("toggle-follow", topic);
};

const handleClickItem = (topic) => {
  if (!props.clickable) return;
  if (!topic?.id) return;
  emit("item-click", topic);
};
</script>

<template>
  <div class="topic-list">
    <a-spin :spinning="loading">
      <a-empty v-if="showEmpty" :description="emptyText" />

      <TransitionGroup
        tag="div"
        class="grid"
        name="topic"
        :data-unfollow="unfollowBehavior"
      >
        <div
          v-for="topic in topics"
          :key="topic.id"
          class="card"
          :class="{ clickable: clickable }"
          :role="clickable ? 'button' : undefined"
          :tabindex="clickable ? 0 : undefined"
          @click="handleClickItem(topic)"
          @keydown.enter.prevent="handleClickItem(topic)"
          @keydown.space.prevent="handleClickItem(topic)"
        >
          <div class="card-main">
            <div class="icon-wrap">
              <img
                class="icon"
                :src="getIcon(topic)"
                :alt="topic?.name || '话题图标'"
                @error="handleIconError"
              />
            </div>

            <div class="info">
              <div class="name">{{ topic?.name }}</div>
              <div class="intro">{{ topic?.introduction || "暂无简介" }}</div>
            </div>

            <button
              v-if="showFollowButton"
              class="follow-btn"
              :class="{ following: Boolean(topic?.is_following) }"
              type="button"
              :disabled="Boolean(followLoadingMap?.[topic?.id])"
              @click.stop="handleToggleFollow(topic)"
            >
              <template v-if="followLoadingMap?.[topic?.id]">处理中</template>
              <template v-else-if="topic?.is_following">
                <span class="follow-label default">已关注</span>
                <span class="follow-label hover">取消关注</span>
              </template>
              <template v-else>
                <span class="follow-label default">关注</span>
              </template>
            </button>
          </div>

          <div class="stats">
            <span class="stat"
              >{{ formatCount(topic?.question_count || 0) }} 个问题</span
            >
            <span class="dot">·</span>
            <span class="stat"
              >{{ formatCount(topic?.follower_count || 0) }} 人关注</span
            >
          </div>
        </div>
      </TransitionGroup>

      <div ref="sentinelRef" class="sentinel" aria-hidden="true"></div>

      <div v-if="loadingMore" class="more">
        <a-spin size="small" />
        <span class="more-text">加载中...</span>
      </div>

      <div v-else-if="topics.length > 0 && !hasMore" class="more done">
        <span class="more-text">没有更多了</span>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.topic-list {
  padding: 16px 18px 18px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 12px;
  padding: 18px 18px 16px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
  transition: transform 0.18s ease, box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.card.clickable {
  cursor: pointer;
}

.card:hover {
  transform: translateY(-2px);
  border-color: rgba(120, 200, 65, 0.28);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.12);
}

.card-main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: #f6f7f9;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  transition: background 0.18s ease;
}

.card:hover .icon-wrap {
  background: rgba(120, 200, 65, 0.12);
}

.icon {
  width: 34px;
  height: 34px;
  object-fit: cover;
}

.info {
  min-width: 0;
  flex: 1;
}

.name {
  font-size: 16px;
  font-weight: 700;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui,
    -apple-system, sans-serif;
  color: #111827;
  line-height: 1.2;
  margin-top: 2px;
  transition: color 0.18s ease;
}

.card:hover .name {
  color: var(--brand-color);
}

.intro {
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.follow-btn {
  flex: none;
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid var(--brand-color);
  background: #fff;
  color: var(--brand-color);
  font-weight: 700;
  font-size: 13px;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.follow-btn:not(.following):hover {
  background: rgba(120, 200, 65, 0.08);
}

.follow-btn:not(.following):hover {
  background: var(--brand-color);
  border-color: var(--brand-color);
  color: #fff;
}

.follow-btn.following {
  border-color: #e5e7eb;
  background: #f6f7f9;
  color: #6b7280;
}

.follow-btn.following:hover {
  background: rgba(239, 68, 68, 0.08);
  border-color: #ef4444;
  color: #ef4444;
}

.follow-label.hover {
  display: none;
}

.follow-btn.following:hover .follow-label.default {
  display: none;
}

.follow-btn.following:hover .follow-label.hover {
  display: inline;
}

.follow-btn:disabled {
  cursor: not-allowed;
  opacity: 0.75;
}

.stats {
  margin-top: 14px;
  color: #94a3b8;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  opacity: 0.9;
}

.sentinel {
  height: 1px;
}

.more {
  margin-top: 14px;
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

.topic-move,
.topic-enter-active,
.topic-leave-active {
  transition: all 0.28s ease;
}

.topic-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.topic-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

.topic-leave-active {
  position: relative;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
