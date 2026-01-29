<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { message } from "ant-design-vue";
import { CommentOutlined, LikeFilled, StarOutlined } from "@ant-design/icons-vue";
import { VOTE_STATUS } from "../constants/vote";
import { formatCount, toPreviewText } from "../utils/format";

const props = defineProps({
  questions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  emptyText: { type: String, default: "暂无内容" },
});

const emit = defineEmits(["load-more", "collect"]);

const sentinelRef = ref(null);
let observer = null;

const showEmpty = computed(() => !props.loading && props.questions.length === 0);

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

const isUpvoted = (status) => Number(status) === VOTE_STATUS.UPVOTE;

const handleCollect = () => {
  emit("collect");
  message.info("收藏功能开发中");
};
</script>

<template>
  <div class="question-list">
    <a-spin :spinning="loading">
      <div class="feed">
        <a-empty v-if="showEmpty" :description="emptyText" />

        <div v-for="item in questions" :key="item.id" class="feed-item">
          <h2 class="title">{{ item.title }}</h2>

          <p class="answer-preview">
            <template v-if="item.top_answer">
              <span class="answerer">
                {{ item.top_answer.respondent?.username || "匿名用户" }}：
              </span>
              {{ toPreviewText(item.top_answer.content, 260) }}
            </template>
            <template v-else>
              {{ toPreviewText(item.content, 260) }}
            </template>
          </p>

          <div class="actions">
            <button
              class="vote-btn"
              :class="{ voted: isUpvoted(item.top_answer?.user_vote_status) }"
              type="button"
              @click="message.info('赞同功能开发中')"
            >
              <LikeFilled />
              <span class="action-text">
                {{ formatCount(item.top_answer?.upvote_count || 0) }} 赞同
              </span>
            </button>

            <div class="action-meta">
              <CommentOutlined />
              <span class="action-text">
                {{ item.top_answer?.comment_count || 0 }} 条评论
              </span>
            </div>

            <button class="action-meta link" type="button" @click="handleCollect">
              <StarOutlined />
              <span class="action-text">收藏</span>
            </button>
          </div>
        </div>
      </div>

      <div ref="sentinelRef" class="sentinel" aria-hidden="true"></div>

      <div v-if="loadingMore" class="more">
        <a-spin size="small" />
        <span class="more-text">加载中...</span>
      </div>

      <div v-else-if="questions.length > 0 && !hasMore" class="more done">
        <span class="more-text">没有更多了</span>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.question-list {
  padding: 0;
}

.feed {
  padding: 0;
}

.feed-item {
  padding: 18px 18px 14px;
}

.feed-item + .feed-item {
  border-top: 1px solid #f0f2f5;
}

.title {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
}

.answer-preview {
  margin: 0;
  color: #334155;
  line-height: 1.75;
  font-size: 14px;
  display: -webkit-box;
  line-clamp: 3;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.answerer {
  font-weight: 800;
  color: #111827;
}

.actions {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 18px;
  color: #94a3b8;
  font-size: 13px;
}

.vote-btn {
  border: none;
  background: rgba(120, 200, 65, 0.12);
  color: var(--brand-color);
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease;
}

.vote-btn:hover {
  background: rgba(120, 200, 65, 0.18);
}

.vote-btn.voted {
  background: var(--brand-color);
  color: #fff;
}

.vote-btn.voted:hover {
  background: var(--brand-color-dark);
}

.action-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.action-meta.link {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.action-meta.link:hover {
  color: var(--brand-color);
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
</style>

