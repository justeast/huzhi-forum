<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";
import { CommentOutlined, LikeFilled, StarFilled } from "@ant-design/icons-vue";
import MarkdownCollapse from "./MarkdownCollapse.vue";
import AnswerCommentSection from "./AnswerCommentSection.vue";
import { fetchCollectionAnswerPage, toggleCollectAnswer } from "../api/collection";
import { voteAnswer } from "../api/answer";
import { VOTE_STATUS } from "../constants/vote";
import { formatCount, formatDateTimeMinute } from "../utils/format";

const props = defineProps({
  open: { type: Boolean, default: false },
  collection: { type: Object, default: null },
  // 只读模式：用于查看他人公开收藏夹（隐藏“移出收藏夹”等可变更操作）
  readonly: { type: Boolean, default: false },
});

const emit = defineEmits(["update:open", "count-change"]);

const router = useRouter();

const collectionId = computed(() => props.collection?.id || "");
const title = computed(() => props.collection?.title || "收藏夹");
const desc = computed(() => props.collection?.description || "");

const PAGE_SIZE = 10;

const loading = ref(false);
const loadingMore = ref(false);
const errorText = ref("");

const totalCount = ref(0);
const nextUrl = ref(null);
const list = ref([]);

const openCommentAnswerId = ref(null);
const expandedKey = ref("");

const voteLoadingMap = ref({});
const removeLoadingMap = ref({});

const scrollRef = ref(null);
const sentinelRef = ref(null);
let observer = null;

const canLoadMore = computed(
  () =>
    Boolean(nextUrl.value) && !loading.value && !loadingMore.value && !errorText.value,
);

const isUpvoted = (status) => Number(status) === VOTE_STATUS.UPVOTE;
const isVoting = (id) => Boolean(voteLoadingMap.value?.[id]);
const isRemoving = (id) => Boolean(removeLoadingMap.value?.[id]);

const setMapFlag = (mapRef, key, value) => {
  mapRef.value = { ...(mapRef.value || {}), [key]: Boolean(value) };
};

const clearMapFlag = (mapRef, key) => {
  const next = { ...(mapRef.value || {}) };
  delete next[key];
  mapRef.value = next;
};

const reset = () => {
  loading.value = false;
  loadingMore.value = false;
  errorText.value = "";
  totalCount.value = 0;
  nextUrl.value = null;
  list.value = [];
  openCommentAnswerId.value = null;
  expandedKey.value = "";
  voteLoadingMap.value = {};
  removeLoadingMap.value = {};
};

const mergeById = (items, incoming) => {
  const map = new Map((items || []).map((t) => [t?.id, t]));
  (incoming || []).forEach((t) => {
    if (!t?.id) return;
    if (map.has(t.id)) map.set(t.id, { ...map.get(t.id), ...t });
    else map.set(t.id, t);
  });
  return Array.from(map.values());
};

const fetchFirstPage = async () => {
  const cid = String(collectionId.value || "");
  if (!cid) return;
  if (loading.value) return;

  loading.value = true;
  errorText.value = "";
  nextUrl.value = null;
  list.value = [];
  openCommentAnswerId.value = null;
  expandedKey.value = "";

  try {
    const data = await fetchCollectionAnswerPage(cid, {
      page: 1,
      size: PAGE_SIZE,
    });
    totalCount.value = Math.max(0, Number(data?.count || 0));
    nextUrl.value = data?.next || null;
    list.value = data?.results || [];
  } catch (error) {
    if (error?.__handled401) return;
    errorText.value = error?.message || "加载失败";
  } finally {
    loading.value = false;
  }
};

const loadMore = async () => {
  const cid = String(collectionId.value || "");
  if (!cid) return;
  if (!nextUrl.value) return;
  if (loading.value || loadingMore.value) return;

  loadingMore.value = true;
  try {
    const data = await fetchCollectionAnswerPage(cid, String(nextUrl.value));
    nextUrl.value = data?.next || null;
    const results = data?.results || [];
    list.value = mergeById(list.value, results);
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "加载更多失败");
  } finally {
    loadingMore.value = false;
  }
};

const observeSentinel = () => {
  if (!sentinelRef.value) return;
  if (!scrollRef.value) return;
  if (observer) observer.disconnect();

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries?.[0];
      if (!entry?.isIntersecting) return;
      if (!canLoadMore.value) return;
      loadMore();
    },
    {
      root: scrollRef.value,
      rootMargin: "240px 0px 240px 0px",
      threshold: 0,
    },
  );

  observer.observe(sentinelRef.value);
};

watch(
  () => props.open,
  async (val) => {
    if (val) {
      await fetchFirstPage();
      observeSentinel();
      return;
    }
    // 抽屉关闭时断开观察，避免后台继续触发 loadMore
    if (observer) observer.disconnect();
    observer = null;
    reset();
  },
);

watch(collectionId, async (val, prev) => {
  if (!props.open) return;
  if (!val || val === prev) return;
  await fetchFirstPage();
});

onMounted(() => {
  if (props.open) {
    fetchFirstPage();
    observeSentinel();
  }
});

onBeforeUnmount(() => {
  if (observer) observer.disconnect();
  observer = null;
});

const close = () => {
  emit("update:open", false);
};

const handleRetry = () => {
  fetchFirstPage();
};

const handleClickQuestion = (item) => {
  const qid = item?.question?.id;
  if (!qid) return;
  router.push(`/question/${qid}`);
};

const getExpandKey = (item) => {
  const id = item?.id;
  return id ? `a:${String(id)}` : "";
};

const isExpanded = (item) => expandedKey.value === getExpandKey(item);

const handleExpandedChange = (item, value) => {
  const key = getExpandKey(item);
  if (!key) return;
  const next = Boolean(value);
  if (next) {
    expandedKey.value = key;
    return;
  }
  if (expandedKey.value === key) expandedKey.value = "";
};

const handleVote = async (item) => {
  const id = item?.id;
  if (!id) return;
  if (isVoting(id)) return;

  setMapFlag(voteLoadingMap, id, true);
  try {
    const current = Number(item?.user_vote_status || 0);
    const voteType = current === VOTE_STATUS.UPVOTE ? 0 : VOTE_STATUS.UPVOTE;
    const data = await voteAnswer(id, voteType);

    item.upvote_count = data?.upvote_count ?? item.upvote_count;
    item.user_vote_status = data?.user_vote_status ?? item.user_vote_status;
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "操作失败");
  } finally {
    clearMapFlag(voteLoadingMap, id);
  }
};

const handleToggleComment = (item) => {
  const id = item?.id;
  if (!id) return;

  const current = String(openCommentAnswerId.value || "");
  const next = String(id || "");
  openCommentAnswerId.value = current === next ? null : id;
};

const handleRemove = async (item) => {
  if (props.readonly) {
    message.info("该收藏夹为只读，暂不支持移出");
    return;
  }
  const cid = String(collectionId.value || "");
  const id = item?.id;
  if (!cid || !id) return;
  if (isRemoving(id)) return;

  setMapFlag(removeLoadingMap, id, true);
  try {
    const res = await toggleCollectAnswer(cid, id);

    // 立即从列表移除，避免用户困惑
    list.value = (list.value || []).filter((x) => x?.id !== id);

    // 同步数量（接口返回的是该收藏夹内回答数）
    const nextCount =
      res?.answer_count !== undefined
        ? Math.max(0, Number(res.answer_count || 0))
        : Math.max(0, Number(totalCount.value || 0) - 1);

    totalCount.value = nextCount;
    emit("count-change", nextCount);

    // 若当前页被移空但仍有 next，则继续拉取，避免“明明还有内容却显示空”
    if ((list.value || []).length === 0 && nextUrl.value) {
      await loadMore();
    }
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "移出失败");
  } finally {
    clearMapFlag(removeLoadingMap, id);
  }
};

const getAvatar = (item) => item?.respondent?.avatar || "/default-avatar.png";
</script>

<template>
  <a-drawer
    :open="open"
    placement="right"
    :width="920"
    class="collection-answer-drawer"
    :bodyStyle="{ padding: '0' }"
    @close="close"
    @update:open="(v) => emit('update:open', v)"
  >
    <template #title>
      <div class="drawer-title">
        <div class="name">{{ title }}</div>
        <div class="meta">
          <span>{{ totalCount }} 条内容</span>
          <span v-if="desc" class="dot">·</span>
          <span v-if="desc" class="desc">{{ desc }}</span>
        </div>
      </div>
    </template>

    <div ref="scrollRef" class="drawer-scroll">
      <a-spin :spinning="loading">
        <div v-if="errorText" class="state">
          <a-empty description="加载失败" />
          <div class="state-text">{{ errorText }}</div>
          <a-button type="primary" @click="handleRetry">重试</a-button>
        </div>

        <a-empty v-else-if="!loading && list.length === 0" description="暂无内容" />

        <div v-else class="list">
          <div v-for="item in list" :key="item.id" class="row">
            <button class="q-title" type="button" @click="handleClickQuestion(item)">
              {{ item?.question?.title || "未命名问题" }}
            </button>

            <div class="head">
              <a-avatar :size="34" :src="getAvatar(item)" />
              <div class="head-meta">
                <div class="user">{{ item?.respondent?.username || "匿名用户" }}</div>
                <div class="time">{{ formatDateTimeMinute(item?.created) }}</div>
              </div>
            </div>

            <div class="content">
              <MarkdownCollapse
                :expanded="isExpanded(item)"
                :content="String(item?.content || '')"
                :collapsedHeight="160"
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

                    <button
                      v-if="!readonly"
                      class="action-meta link remove-btn"
                      type="button"
                      :disabled="isRemoving(item?.id)"
                      @click.stop="handleRemove(item)"
                    >
                      <StarFilled />
                      <span class="action-text">移出收藏夹</span>
                    </button>
                  </div>
                </template>
              </MarkdownCollapse>
            </div>

            <div v-if="!isExpanded(item)" class="actions">
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

              <button
                v-if="!readonly"
                class="action-meta link remove-btn"
                type="button"
                :disabled="isRemoving(item?.id)"
                @click.stop="handleRemove(item)"
              >
                <StarFilled />
                <span class="action-text">移出收藏夹</span>
              </button>
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

        <div v-else-if="!nextUrl && list.length > 0" class="more done">
          <span class="more-text">没有更多了</span>
        </div>
      </a-spin>
    </div>
  </a-drawer>
</template>

<style scoped>
.drawer-title {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.drawer-title .name {
  font-weight: 900;
  color: #111827;
  line-height: 1.2;
}

.drawer-title .meta {
  min-width: 0;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
  display: flex;
  align-items: center;
  gap: 6px;
}

.drawer-title .desc {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-scroll {
  height: 100%;
  overflow: auto;
  padding: 14px 18px 18px;
}

.state {
  padding: 14px 0;
  display: grid;
  justify-items: center;
  gap: 10px;
}

.state-text {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.list {
  display: grid;
  gap: 12px;
}

.row {
  border: 1px solid #eef0f3;
  border-radius: 10px;
  background: #fff;
  padding: 14px 14px 12px;
}

.q-title {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: left;
  color: #111827;
  font-weight: 900;
  font-size: 15px;
  line-height: 1.35;
}

.q-title:hover {
  color: var(--brand-color);
}

.head {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-meta {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 2px;
}

.user {
  font-weight: 900;
  color: #111827;
  font-size: 13px;
  line-height: 1.2;
}

.time {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
}

.content {
  margin-top: 10px;
  color: #334155;
  line-height: 1.85;
  font-size: 14px;
  word-break: break-word;
}

.actions {
  margin-top: 12px;
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

.action-meta.link:hover {
  color: var(--brand-color);
}

.action-meta.link:disabled,
.vote-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  pointer-events: none;
}

.remove-btn {
  color: #f59e0b;
}

.remove-btn:hover {
  color: #f59e0b;
}

.comment-wrap {
  margin-top: 8px;
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

@media (max-width: 1100px) {
  .drawer-scroll {
    padding: 12px 12px 18px;
  }
}
</style>
