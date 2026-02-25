<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";
import {
  CommentOutlined,
  LikeFilled,
  StarFilled,
  StarOutlined,
} from "@ant-design/icons-vue";
import { VOTE_STATUS } from "../constants/vote";
import { formatCount, toPreviewText } from "../utils/format";

const router = useRouter();

const props = defineProps({
  questions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  emptyText: { type: String, default: "暂无内容" },
  voteLoadingMap: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["load-more", "vote", "collect"]);

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
const isVoting = (answerId) => Boolean(props.voteLoadingMap?.[answerId]);
const isCollected = (value) => Boolean(value);

const handleClickItem = (item) => {
  const id = item?.id;
  if (!id) return;
  router.push(`/question/${id}`);
};

const handleVote = (item) => {
  const ans = item?.top_answer;
  if (!ans?.id) {
    message.info("暂无回答，无法赞同");
    return;
  }
  if (isVoting(ans.id)) return;
  emit("vote", item, ans);
};

const handleCollectAnswer = (item) => {
  const ans = item?.top_answer;
  if (!ans?.id) {
    message.info("暂无回答，无法收藏");
    return;
  }
  emit("collect", item, ans);
};
</script>

<template>
  <div class="question-list">
    <a-spin :spinning="loading">
      <div class="feed">
        <a-empty v-if="showEmpty" :description="emptyText" />

        <div
          v-for="item in questions"
          :key="item.id"
          class="feed-item"
          role="button"
          tabindex="0"
          @click="handleClickItem(item)"
          @keydown.enter.prevent="handleClickItem(item)"
          @keydown.space.prevent="handleClickItem(item)"
        >
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
              :disabled="!item.top_answer?.id || isVoting(item.top_answer?.id)"
              @click.stop="handleVote(item)"
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

            <button
              class="action-meta link"
              :class="{ collected: isCollected(item.top_answer?.is_collected) }"
              type="button"
              :disabled="!item.top_answer?.id"
              @click.stop="handleCollectAnswer(item)"
            >
              <template v-if="isCollected(item.top_answer?.is_collected)">
                <StarFilled />
              </template>
              <template v-else>
                <StarOutlined />
              </template>
              <span class="action-text">{{
                isCollected(item.top_answer?.is_collected) ? "已收藏" : "收藏"
              }}</span>
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
  transition: background 0.18s ease;
  cursor: pointer;
}

.feed-item:hover {
  background: rgba(120, 200, 65, 0.06);
}

.feed-item + .feed-item {
  border-top: 1px solid #f0f2f5;
}

.title {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
  transition: color 0.18s ease;
}

.feed-item:hover .title {
  color: var(--brand-color);
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

.action-meta.link:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  pointer-events: none;
}

.action-meta.link.collected {
  color: #f59e0b;
}

.action-meta.link.collected:hover {
  color: #f59e0b;
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
