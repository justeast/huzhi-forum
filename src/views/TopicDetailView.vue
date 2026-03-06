<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useRoute } from "vue-router";
import AppHeader from "../components/AppHeader.vue";
import QuestionList from "../components/QuestionList.vue";
import CollectAnswerModal from "../components/CollectAnswerModal.vue";
import { fetchTopicDetail, toggleTopicFollow } from "../api/topic";
import { fetchQuestionList } from "../api/question";
import { voteAnswer } from "../api/answer";
import { useTopicFollowStore } from "../stores/topicFollow";
import { VOTE_STATUS } from "../constants/vote";
import { formatCount } from "../utils/format";

const route = useRoute();
const topicFollowStore = useTopicFollowStore();

const headerKeyword = ref("");
const keyword = ref("");

const topicId = computed(() => String(route.params?.id || ""));

const topic = ref(null);
const topicLoading = ref(false);
const topicFollowLoading = ref(false);

const questionCountText = computed(() => {
  if (!topic.value) return "0 个问题";
  const count = Number(topic.value?.question_count || 0);
  return `${formatCount(count)} 个问题`;
});

const questions = ref([]);
const loading = ref(false);
const loadingMore = ref(false);
const page = ref(0);
const hasMore = ref(false);
const PAGE_SIZE = 10;

const voteLoadingMap = ref({});

// 收藏弹窗（对 top_answer 进行收藏）
const collectModalOpen = ref(false);
const collectAnswerId = ref("");
const collectAnswerLabel = ref("");

const showTopic = computed(() => !topicLoading.value && Boolean(topic.value?.id));

const setMapFlag = (mapRef, key, value) => {
  mapRef.value = { ...(mapRef.value || {}), [key]: Boolean(value) };
};

const clearMapFlag = (mapRef, key) => {
  const next = { ...(mapRef.value || {}) };
  delete next[key];
  mapRef.value = next;
};

const getIcon = (t) => t?.icon || "/default-topic.svg";

const handleIconError = (event) => {
  const el = event?.target;
  if (!el || el.dataset?.fallbackApplied) return;
  el.dataset.fallbackApplied = "1";
  el.src = "/default-topic.svg";
};

const mergeById = (items, incoming) => {
  const map = new Map((items || []).map((x) => [x?.id, x]));
  (incoming || []).forEach((x) => {
    if (!x?.id) return;
    if (map.has(x.id)) map.set(x.id, { ...map.get(x.id), ...x });
    else map.set(x.id, x);
  });
  return Array.from(map.values());
};

const resetQuestions = () => {
  questions.value = [];
  page.value = 0;
  hasMore.value = false;
};

const fetchQuestions = async ({ reset } = { reset: false }) => {
  const id = topicId.value;
  if (!id) return;
  if (loading.value || loadingMore.value) return;
  if (!reset && !hasMore.value) return;

  const isReset = Boolean(reset);
  if (reset) {
    loading.value = true;
    resetQuestions();
  } else {
    loadingMore.value = true;
  }

  const nextPage = isReset ? 1 : page.value + 1;

  try {
    const data = await fetchQuestionList({
      page: nextPage,
      size: PAGE_SIZE,
      // 话题详情：按话题筛选，不使用 scene=home（避免首页推荐过滤规则影响话题内容的完整性）
      topics: id,
      search: String(keyword.value || "").trim() || undefined,
    });

    const results = data?.results || [];
    questions.value = mergeById(questions.value, results);
    page.value = nextPage;
    // 兼容后端分页边界：部分场景 next 可能存在，但下一页实际会 404
    hasMore.value = Boolean(data?.next) && results.length >= PAGE_SIZE;
  } catch (error) {
    if (error?.__handled401) return;
    const status = Number(error?.response?.status || 0);
    // 加载更多时遇到 404：视为“没有更多了”，不提示报错
    if (!isReset && status === 404) {
      hasMore.value = false;
      return;
    }
    message.error(error?.message || "获取问题列表失败");
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

const loadTopic = async (id) => {
  if (!id) return;
  if (topicLoading.value) return;
  topicLoading.value = true;
  topic.value = null;

  try {
    const data = await fetchTopicDetail(id);
    topic.value = topicFollowStore.applyToTopic(data);
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "获取话题详情失败");
  } finally {
    topicLoading.value = false;
  }
};

watch(
  topicId,
  async (id) => {
    headerKeyword.value = "";
    keyword.value = "";
    // 先拉问题列表，避免等待话题详情期间触发 “load-more” 导致 page 跳到 2（进而出现 404）
    fetchQuestions({ reset: true });
    await loadTopic(id);
  },
  { immediate: true },
);

const handleHeaderSearch = (value) => {
  keyword.value = String(value || "").trim();
  headerKeyword.value = keyword.value;
  fetchQuestions({ reset: true });
};

watch(headerKeyword, (nextValue, prevValue) => {
  const next = String(nextValue || "").trim();
  const prev = String(prevValue || "").trim();

  // 从“有值”变为“清空”：视为重置搜索
  if (!prev || next) return;
  if (!keyword.value) return;

  keyword.value = "";
  fetchQuestions({ reset: true });
});

const handleToggleFollow = async () => {
  const id = topic.value?.id;
  if (!id) return;
  if (topicFollowLoading.value) return;

  topicFollowLoading.value = true;
  try {
    const action = topic.value?.is_following ? 2 : 1;
    const data = await toggleTopicFollow(id, action);

    // 后端接口会返回最新状态，优先以接口为准
    topic.value.is_following = Boolean(data?.is_following ?? !topic.value.is_following);
    if (data?.follower_count !== undefined) {
      topic.value.follower_count = Math.max(0, Number(data.follower_count || 0));
    } else {
      // 兜底：按动作增减
      topic.value.follower_count = Math.max(
        0,
        Number(topic.value?.follower_count || 0) + (action === 1 ? 1 : -1),
      );
    }

    topicFollowStore.setTopicState(id, {
      is_following: topic.value.is_following,
      follower_count: topic.value.follower_count,
    });

    if (action === 2) topicFollowStore.markFollowTopicsDirty();
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "操作失败");
  } finally {
    topicFollowLoading.value = false;
  }
};

const isVoting = (answerId) => Boolean(voteLoadingMap.value?.[answerId]);

const handleVoteTopAnswer = async (_question, answer) => {
  const answerId = answer?.id;
  if (!answerId) return;
  if (isVoting(answerId)) return;

  const current = Number(answer?.user_vote_status || 0);
  const voteType =
    current === VOTE_STATUS.UPVOTE ? VOTE_STATUS.NONE : VOTE_STATUS.UPVOTE;

  setMapFlag(voteLoadingMap, answerId, true);
  try {
    const patch = await voteAnswer(answerId, voteType);
    if (patch?.upvote_count !== undefined) answer.upvote_count = patch.upvote_count;
    if (patch?.comment_count !== undefined) answer.comment_count = patch.comment_count;
    if (patch?.user_vote_status !== undefined)
      answer.user_vote_status = patch.user_vote_status;
    if (patch?.modified !== undefined) answer.modified = patch.modified;
    if (patch?.is_collected !== undefined) answer.is_collected = patch.is_collected;
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "投票失败");
  } finally {
    clearMapFlag(voteLoadingMap, answerId);
  }
};

const openCollectModal = (_questionItem, answer) => {
  const answerId = answer?.id;
  if (!answerId) return;
  collectAnswerId.value = answerId;
  collectAnswerLabel.value = `${answer?.respondent?.username || "匿名用户"} 的回答`;
  collectModalOpen.value = true;
};

const applyCollectResultToTopAnswer = (answerId, { beforeSize, afterSize }) => {
  const hit = (questions.value || []).find((q) => q?.top_answer?.id === answerId);
  if (!hit?.top_answer) return;
  hit.top_answer.is_collected = afterSize > 0;

  // 若存在 collected_count（有的接口会带），按用户去重：仅 0<->1 跨越时变化
  if (hit.top_answer.collected_count !== undefined) {
    if (beforeSize === 0 && afterSize === 1) {
      hit.top_answer.collected_count = Math.max(
        0,
        Number(hit.top_answer.collected_count || 0) + 1,
      );
    } else if (beforeSize === 1 && afterSize === 0) {
      hit.top_answer.collected_count = Math.max(
        0,
        Number(hit.top_answer.collected_count || 0) - 1,
      );
    }
  }
};

onMounted(() => {
  // 初次进入时：若地址栏自带查询，可用于默认搜索（可选，这里保持简单）
});

onBeforeUnmount(() => {
  // 无需额外清理
});
</script>

<template>
  <div class="topic-detail-page">
    <AppHeader
      v-model="headerKeyword"
      searchPlaceholder="搜索该话题下的问题..."
      @search="handleHeaderSearch"
    />

    <div class="container">
      <main class="main">
        <a-card class="topic-card" :bordered="false">
          <a-spin :spinning="topicLoading">
            <div v-if="topic" class="topic-head">
              <div class="icon-wrap">
                <img
                  class="icon"
                  :src="getIcon(topic)"
                  :alt="topic?.name || '话题图标'"
                  @error="handleIconError"
                />
              </div>

              <div class="info">
                <div class="name">{{ topic?.name || "未命名话题" }}</div>
                <div class="intro">{{ topic?.introduction || "暂无简介" }}</div>

                <div class="stats">
                  <span class="stat">{{ formatCount(topic?.follower_count || 0) }} 人关注</span>
                </div>
              </div>

              <div class="ops">
                <button
                  class="follow-btn"
                  :class="{ following: Boolean(topic?.is_following) }"
                  type="button"
                  :disabled="topicFollowLoading"
                  @click="handleToggleFollow"
                >
                  <template v-if="topicFollowLoading">处理中</template>
                  <template v-else-if="topic?.is_following">
                    <span class="follow-label default">已关注</span>
                    <span class="follow-label hover">取消关注</span>
                  </template>
                  <template v-else>
                    <span class="follow-label default">关注</span>
                  </template>
                </button>
              </div>
            </div>

            <a-empty v-else description="话题不存在或已被删除" />
          </a-spin>
        </a-card>

        <a-card class="list-card" :bordered="false">
          <div class="list-head">
            <div class="list-title">{{ questionCountText }}</div>
          </div>

          <QuestionList
            :questions="questions"
            :loading="loading"
            :loadingMore="loadingMore"
            :hasMore="hasMore"
            :voteLoadingMap="voteLoadingMap"
            emptyText="暂无问题"
            @load-more="() => fetchQuestions({ reset: false })"
            @vote="handleVoteTopAnswer"
            @collect="openCollectModal"
          />
        </a-card>
      </main>

      <aside class="aside">
        <a-card class="side-card" :bordered="false">
          <div class="side-title">关于话题</div>
          <div class="side-desc">
            <template v-if="showTopic">
              关注话题后，系统会为你推荐更多与该话题相关的问题与回答。
            </template>
            <template v-else>加载话题信息中…</template>
          </div>
        </a-card>
      </aside>
    </div>

    <a-back-top class="huzhi-back-top" :visibilityHeight="300" />

    <CollectAnswerModal
      v-model:open="collectModalOpen"
      :answerId="collectAnswerId"
      :answerLabel="collectAnswerLabel"
      @applied="
        ({ answerId, beforeSize, afterSize }) =>
          applyCollectResultToTopAnswer(answerId, { beforeSize, afterSize })
      "
    />
  </div>
</template>

<style scoped>
:global(:root) {
  --bg: #f5f7fb;
  --card: #ffffff;
  --line: #eef0f3;
  --text: #1f2d3d;
  --subtle: #8c9ba5;
}

.topic-detail-page {
  min-height: 100vh;
  background: var(--bg);
}

.container {
  max-width: 1200px;
  margin: 18px auto 0;
  padding: 0 16px 60px;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
}

.topic-card,
.list-card,
.side-card {
  border-radius: 12px;
  border: 1px solid var(--line);
}

.main {
  min-width: 0;
  display: grid;
  gap: 16px;
}

.topic-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #f6f7f9;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.icon {
  width: 44px;
  height: 44px;
  object-fit: cover;
}

.info {
  min-width: 0;
  flex: 1;
}

.name {
  font-size: 22px;
  font-weight: 900;
  color: #111827;
  line-height: 1.2;
  margin-top: 2px;
}

.intro {
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.6;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.stats {
  margin-top: 10px;
  color: #94a3b8;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ops {
  flex: none;
}

.follow-btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid var(--brand-color);
  background: #fff;
  color: var(--brand-color);
  font-weight: 900;
  font-size: 13px;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
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

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px 0;
}

.list-title {
  font-weight: 900;
  color: #111827;
  font-size: 16px;
}

.search {
  width: 320px;
  max-width: 55%;
}

.search-icon {
  color: #94a3b8;
  cursor: pointer;
}

.search-icon:hover {
  color: var(--brand-color);
}

.aside {
  position: sticky;
  top: 82px;
  height: fit-content;
}

.side-title {
  font-weight: 900;
  font-size: 16px;
  color: #111827;
  margin-bottom: 10px;
}

.side-desc {
  color: #64748b;
  font-weight: 700;
  font-size: 13px;
  line-height: 1.7;
}

:global(.huzhi-back-top .ant-float-btn) {
  width: 44px;
  height: 44px;
}

:global(.huzhi-back-top .ant-float-btn-icon),
:global(.huzhi-back-top .ant-float-btn-content),
:global(.huzhi-back-top .anticon) {
  color: var(--brand-color) !important;
}

:global(.huzhi-back-top svg) {
  fill: var(--brand-color) !important;
}

@media (max-width: 1100px) {
  .container {
    grid-template-columns: 1fr;
  }
  .aside {
    position: static;
  }
  .search {
    width: 100%;
    max-width: 100%;
  }
  .list-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
