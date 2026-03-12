<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import {
  CommentOutlined,
  DislikeFilled,
  DislikeOutlined,
  LikeFilled,
  StarOutlined,
  StarFilled,
} from "@ant-design/icons-vue";
import AnswerCommentSection from "./AnswerCommentSection.vue";
import MarkdownCollapse from "./MarkdownCollapse.vue";
import { VOTE_STATUS } from "../constants/vote";
import { formatCount, formatCreatedModifiedLabel } from "../utils/format";

const props = defineProps({
  answers: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  emptyText: { type: String, default: "暂无回答" },
  voteLoadingMap: { type: Object, default: () => ({}) },
  collectLoadingMap: { type: Object, default: () => ({}) },
  // 是否启用“点击头像进入用户主页”
  enableUserLink: { type: Boolean, default: false },
});

const emit = defineEmits(["load-more", "vote", "collect", "user-click"]);

const openCommentAnswerId = ref(null);
const expandedMap = reactive({});
const highlightedAnswerId = ref("");

const sentinelRef = ref(null);
const answerRowRefMap = new Map();
const commentSectionRefMap = new Map();
let observer = null;
let answerHighlightTimer = null;

const showEmpty = computed(() => !props.loading && props.answers.length === 0);

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
  if (answerHighlightTimer) {
    clearTimeout(answerHighlightTimer);
    answerHighlightTimer = null;
  }
});

const isUpvoted = (status) => Number(status) === VOTE_STATUS.UPVOTE;
const isDownvoted = (status) => Number(status) === VOTE_STATUS.DOWNVOTE;

const isVoting = (id) => Boolean(props.voteLoadingMap?.[id]);
const isCollecting = (id) => Boolean(props.collectLoadingMap?.[id]);

const handleUpvote = (item) => {
  if (!item?.id) return;
  if (isVoting(item.id)) return;
  emit("vote", item, VOTE_STATUS.UPVOTE);
};

const handleDownvote = (item) => {
  if (!item?.id) return;
  if (isVoting(item.id)) return;
  emit("vote", item, VOTE_STATUS.DOWNVOTE);
};

const handleCollect = (item) => {
  if (!item?.id) return;
  if (isCollecting(item.id)) return;
  emit("collect", item);
};

const setAnswerRowRef = (answerId, el) => {
  const id = String(answerId || "");
  if (!id) return;
  if (el) {
    answerRowRefMap.set(id, el);
    return;
  }
  answerRowRefMap.delete(id);
};

const setCommentSectionRef = (answerId, instance) => {
  const id = String(answerId || "");
  if (!id) return;
  if (instance) {
    commentSectionRefMap.set(id, instance);
    return;
  }
  commentSectionRefMap.delete(id);
};

const triggerAnswerHighlight = (answerId) => {
  const id = String(answerId || "");
  if (!id) return;
  highlightedAnswerId.value = id;
  if (answerHighlightTimer) clearTimeout(answerHighlightTimer);
  answerHighlightTimer = setTimeout(() => {
    if (highlightedAnswerId.value === id) highlightedAnswerId.value = "";
    answerHighlightTimer = null;
  }, 2200);
};

const scrollToAnswer = async (answerId, { highlight = true, behavior = "smooth" } = {}) => {
  const id = String(answerId || "");
  if (!id) return false;
  await nextTick();
  const el = answerRowRefMap.get(id);
  if (!el) return false;
  el.scrollIntoView({ behavior, block: "center" });
  if (highlight) triggerAnswerHighlight(id);
  return true;
};

const openCommentsForAnswer = async (answerId) => {
  const id = String(answerId || "");
  if (!id) return null;
  openCommentAnswerId.value = id;
  await nextTick();
  await nextTick();
  return commentSectionRefMap.get(id) || null;
};

const locateCommentInAnswer = async (answerId, commentId, parentCommentId) => {
  const section = await openCommentsForAnswer(answerId);
  if (!section?.locateComment) return false;
  return section.locateComment(commentId, parentCommentId);
};

const handleToggleComment = (item) => {
  if (!item?.id) return;
  const current = String(openCommentAnswerId.value || "");
  const next = String(item.id || "");
  openCommentAnswerId.value = current === next ? null : item.id;
};

const handleExpandedChange = (id, value) => {
  const key = String(id || "");
  if (!key) return;
  const next = Boolean(value);
  if (next) {
    // 同一时间只展开一个回答，避免多个固定栏叠加
    Object.keys(expandedMap).forEach((k) => {
      expandedMap[k] = false;
    });
    expandedMap[key] = true;
    return;
  }
  expandedMap[key] = false;
};

const isCollected = (value) => Boolean(value);

const getAvatar = (item) => item?.respondent?.avatar || "/default-avatar.png";

const handleClickUser = (item) => {
  if (!props.enableUserLink) return;
  const uid = item?.respondent?.id;
  if (!uid) return;
  emit("user-click", uid);
};

defineExpose({
  scrollToAnswer,
  openCommentsForAnswer,
  locateCommentInAnswer,
});
</script>

<template>
  <div class="answer-feed">
    <a-spin :spinning="loading">
      <a-empty v-if="showEmpty" :description="emptyText" />

      <div v-else class="list">
        <div
          v-for="item in answers"
          :key="item.id"
          :ref="(el) => setAnswerRowRef(item?.id, el)"
          class="row"
          :class="{ highlighted: highlightedAnswerId === String(item?.id || '') }"
          :data-answer-id="item?.id"
        >
          <div class="head">
            <div
              class="avatar-link"
              :class="{ clickable: enableUserLink }"
              :role="enableUserLink ? 'button' : undefined"
              :tabindex="enableUserLink ? 0 : undefined"
              @click.stop="handleClickUser(item)"
              @keydown.enter.prevent="handleClickUser(item)"
              @keydown.space.prevent="handleClickUser(item)"
            >
              <a-avatar :size="36" :src="getAvatar(item)" />
            </div>
            <div class="meta">
              <div class="name">
                {{ item?.respondent?.username || "匿名用户" }}
              </div>
            </div>

            <div class="time">
              {{ formatCreatedModifiedLabel(item?.created, item?.modified) }}
            </div>
          </div>

          <div class="content">
            <MarkdownCollapse
              :expanded="Boolean(expandedMap[String(item?.id)])"
              :content="String(item?.content || '')"
              :collapsedHeight="260"
              expandText="阅读全文"
              collapseText="收起"
              @update:expanded="(v) => handleExpandedChange(item?.id, v)"
            >
              <template #actions>
                <div class="sticky-actions-row">
                  <button
                    class="vote-btn"
                    :class="{ voted: isUpvoted(item?.user_vote_status) }"
                    type="button"
                    :disabled="isVoting(item?.id)"
                    @click="handleUpvote(item)"
                  >
                    <LikeFilled />
                    <span class="action-text">
                      {{ formatCount(item?.upvote_count || 0) }} 赞同
                    </span>
                  </button>

                  <button
                    class="action-meta link icon-only"
                    :class="{ downvoted: isDownvoted(item?.user_vote_status) }"
                    type="button"
                    :disabled="isVoting(item?.id)"
                    @click="handleDownvote(item)"
                  >
                    <template v-if="isDownvoted(item?.user_vote_status)">
                      <DislikeFilled />
                    </template>
                    <template v-else>
                      <DislikeOutlined />
                    </template>
                  </button>

                  <button
                    class="action-meta link"
                    type="button"
                    :disabled="!item?.id"
                    @click="handleToggleComment(item)"
                  >
                    <CommentOutlined />
                    <span class="action-text">
                      {{ Number(item?.comment_count || 0) }} 评论
                    </span>
                  </button>

                  <button
                    class="action-meta link collect-btn"
                    :class="{ collected: isCollected(item?.is_collected) }"
                    type="button"
                    :disabled="isCollecting(item?.id)"
                    @click="handleCollect(item)"
                  >
                    <template v-if="isCollected(item?.is_collected)">
                      <StarFilled />
                    </template>
                    <template v-else>
                      <StarOutlined />
                    </template>
                    <span class="action-text">{{
                      isCollected(item?.is_collected) ? "已收藏" : "收藏"
                    }}</span>
                  </button>
                </div>
              </template>
            </MarkdownCollapse>
          </div>

          <div v-if="!expandedMap[String(item?.id)]" class="actions">
            <button
              class="vote-btn"
              :class="{ voted: isUpvoted(item?.user_vote_status) }"
              type="button"
              :disabled="isVoting(item?.id)"
              @click="handleUpvote(item)"
            >
              <LikeFilled />
              <span class="action-text">
                {{ formatCount(item?.upvote_count || 0) }} 赞同
              </span>
            </button>

            <button
              class="action-meta link icon-only"
              :class="{ downvoted: isDownvoted(item?.user_vote_status) }"
              type="button"
              :disabled="isVoting(item?.id)"
              @click="handleDownvote(item)"
            >
              <template v-if="isDownvoted(item?.user_vote_status)">
                <DislikeFilled />
              </template>
              <template v-else>
                <DislikeOutlined />
              </template>
            </button>

            <button
              class="action-meta link"
              type="button"
              :disabled="!item?.id"
              @click="handleToggleComment(item)"
            >
              <CommentOutlined />
              <span class="action-text">
                {{ Number(item?.comment_count || 0) }} 评论
              </span>
            </button>

            <button
              class="action-meta link collect-btn"
              :class="{ collected: isCollected(item?.is_collected) }"
              type="button"
              :disabled="isCollecting(item?.id)"
              @click="handleCollect(item)"
            >
              <template v-if="isCollected(item?.is_collected)">
                <StarFilled />
              </template>
              <template v-else>
                <StarOutlined />
              </template>
              <span class="action-text">{{
                isCollected(item?.is_collected) ? "已收藏" : "收藏"
              }}</span>
            </button>
          </div>

          <div
            v-if="String(openCommentAnswerId) === String(item?.id)"
            class="comment-wrap"
          >
            <AnswerCommentSection
              :ref="(instance) => setCommentSectionRef(item?.id, instance)"
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
.answer-feed {
  padding: 0;
}

.list {
  padding: 0;
}

.row {
  padding: 18px 18px 14px;
  transition: background 0.18s ease;
}

.row + .row {
  border-top: 1px solid #f0f2f5;
}

.row:hover {
  background: rgba(120, 200, 65, 0.06);
}

.row.highlighted {
  background: rgba(120, 200, 65, 0.12);
  box-shadow: inset 0 0 0 1px rgba(120, 200, 65, 0.2);
}

.head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-link.clickable {
  cursor: pointer;
}

.avatar-link.clickable:focus-visible {
  outline: 2px solid rgba(120, 200, 65, 0.6);
  outline-offset: 2px;
  border-radius: 10px;
}

.meta {
  min-width: 0;
  flex: 1;
}

.name {
  font-weight: 900;
  color: #111827;
  font-size: 14px;
  line-height: 1.2;
  transition: color 0.18s ease;
}

.row:hover .name {
  color: var(--brand-color);
}

.time {
  color: #94a3b8;
  font-size: 13px;
  font-weight: 700;
  flex: none;
  white-space: nowrap;
}

.content {
  margin-top: 12px;
  color: #334155;
  line-height: 1.85;
  font-size: 14px;
  word-break: break-word;
}

.content :deep(.md-editor-preview-wrapper) {
  padding: 0;
  background: transparent;
}

.content :deep(p) {
  margin: 0 0 8px;
}

.content :deep(img) {
  max-width: 100%;
  height: auto;
}

.actions {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 18px;
  color: #94a3b8;
  font-size: 13px;
  flex-wrap: wrap;
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
  color: inherit;
}

.action-meta.link.icon-only {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.action-meta.link:hover {
  color: var(--brand-color);
}

.action-meta.link:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  pointer-events: none;
}

.action-meta.link.icon-only.downvoted {
  color: #ef4444;
}

.collect-btn.collected {
  color: #f59e0b;
}

.collect-btn.collected:hover {
  color: #f59e0b;
}

.comment-wrap {
  margin-top: 6px;
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
