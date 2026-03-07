<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { CommentOutlined, LikeFilled } from "@ant-design/icons-vue";
import AnswerCommentSection from "./AnswerCommentSection.vue";
import MarkdownCollapse from "./MarkdownCollapse.vue";
import { VOTE_STATUS } from "../constants/vote";
import { formatDateTimeMinute, formatCount } from "../utils/format";

const props = defineProps({
  answers: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  emptyText: { type: String, default: "暂无回答" },
  voteLoadingMap: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["load-more", "item-click", "vote"]);

const sentinelRef = ref(null);
let observer = null;
const openCommentAnswerId = ref(null);
const expandedAnswerId = ref("");

const showEmpty = computed(() => !props.loading && props.answers.length === 0);

const canLoadMore = computed(
  // 列表为空时不触发自动 load-more，避免“首屏未加载就先翻页”的请求
  () =>
    props.answers.length > 0 &&
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

const isUpvoted = (status) => Number(status) === VOTE_STATUS.UPVOTE;
const isVoting = (id) => Boolean(props.voteLoadingMap?.[id]);

const getExpandKey = (item) => {
  const id = item?.id;
  return id ? String(id) : "";
};

const isExpanded = (item) => expandedAnswerId.value === getExpandKey(item);

const handleClickItem = (item) => {
  emit("item-click", item);
};

const handleVote = (item) => {
  const id = item?.id;
  if (!id) return;
  if (isVoting(id)) return;
  emit("vote", item);
};

const handleToggleComment = (item) => {
  const id = item?.id;
  if (!id) return;
  const current = String(openCommentAnswerId.value || "");
  const next = String(id || "");
  openCommentAnswerId.value = current === next ? null : id;
};

const handleExpandedChange = (item, value) => {
  const key = getExpandKey(item);
  if (!key) return;
  const next = Boolean(value);
  if (next) {
    // 同一时间只展开一个回答，避免多个固定栏叠加
    expandedAnswerId.value = key;
    return;
  }
  if (expandedAnswerId.value === key) expandedAnswerId.value = "";
};
</script>

<template>
  <div class="user-answer-list">
    <a-spin :spinning="loading">
      <a-empty v-if="showEmpty" :description="emptyText" />

      <div v-else class="list">
        <div
          v-for="item in answers"
          :key="item.id"
          class="row"
          role="button"
          tabindex="0"
          @click="handleClickItem(item)"
        >
          <div class="title">{{ item?.question?.title }}</div>

          <div class="content">
            <MarkdownCollapse
              :expanded="isExpanded(item)"
              :content="String(item?.content || '')"
              :collapsedHeight="84"
              expandText="阅读全文"
              collapseText="收起"
              @update:expanded="(v) => handleExpandedChange(item, v)"
            >
              <template #actions>
                <div class="sticky-actions-row">
                  <button
                    class="vote-btn"
                    :class="{ voted: isUpvoted(item?.user_vote_status) }"
                    type="button"
                    :disabled="isVoting(item?.id)"
                    @click.stop="handleVote(item)"
                  >
                    <LikeFilled />
                    <span class="action-text">
                      {{ formatCount(item?.upvote_count || 0) }} 赞同
                    </span>
                  </button>

                  <button
                    class="action-meta link"
                    type="button"
                    :disabled="!item?.id"
                    @click.stop="handleToggleComment(item)"
                  >
                    <CommentOutlined />
                    <span class="action-text">
                      {{ Number(item?.comment_count || 0) }} 评论
                    </span>
                  </button>
                </div>
              </template>
            </MarkdownCollapse>
          </div>

          <div v-if="!isExpanded(item)" class="bottom">
            <div class="actions">
              <button
                class="vote-btn"
                :class="{ voted: isUpvoted(item?.user_vote_status) }"
                type="button"
                :disabled="isVoting(item?.id)"
                @click.stop="handleVote(item)"
              >
                <LikeFilled />
                <span class="action-text">
                  {{ formatCount(item?.upvote_count || 0) }} 赞同
                </span>
              </button>

              <button
                class="action-meta link"
                type="button"
                :disabled="!item?.id"
                @click.stop="handleToggleComment(item)"
              >
                <CommentOutlined />
                <span class="action-text">
                  {{ Number(item?.comment_count || 0) }} 评论
                </span>
              </button>
            </div>

            <div class="time">
              {{ formatDateTimeMinute(item?.created) }}
            </div>
          </div>

          <div
            v-if="String(openCommentAnswerId) === String(item?.id)"
            class="comment-wrap"
            @click.stop
          >
            <AnswerCommentSection
              :answerId="item?.id"
              :answerAuthorId="item?.respondent?.id"
              :commentCount="item?.comment_count"
              :pageSize="20"
              @count-change="(v) => (item.comment_count = v)"
              @collapse="() => handleToggleComment(item)"
            />
          </div>
        </div>
      </div>

      <div ref="sentinelRef" class="sentinel" aria-hidden="true"></div>

      <div v-if="loadingMore" class="more">
        <a-spin size="small" />
        <span class="more-text">加载中...</span>
      </div>

      <div v-else-if="answers.length > 0 && !hasMore" class="more done">
        <span class="more-text">没有更多了</span>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.user-answer-list {
  padding: 0;
}

.list {
  padding: 0;
}

.row {
  padding: 18px 18px 14px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.row + .row {
  border-top: 1px solid #f0f2f5;
}

.row:hover {
  background: rgba(120, 200, 65, 0.06);
}

.title {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 800;
  color: #111827;
  transition: color 0.18s ease;
}

.row:hover .title {
  color: var(--brand-color);
}

.content {
  margin: 0;
  color: #334155;
  line-height: 1.75;
  font-size: 14px;
}

.bottom {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 18px;
  color: #94a3b8;
  font-size: 13px;
}

.sticky-actions-row {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
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
  color: inherit;
}

.action-meta.link:hover {
  color: var(--brand-color);
}

.action-meta.link:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  pointer-events: none;
}

.comment-wrap {
  margin-top: 6px;
}

.time {
  color: #94a3b8;
  font-size: 13px;
  font-weight: 700;
  flex: none;
  white-space: nowrap;
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
