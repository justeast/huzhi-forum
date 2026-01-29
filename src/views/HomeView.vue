<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";
import { DownOutlined } from "@ant-design/icons-vue";
import AppHeader from "../components/AppHeader.vue";
import { fetchFollowingQuestionList, fetchQuestionList } from "../api/question";
import {
  fetchFollowingTopics,
  fetchTopicList,
  toggleTopicFollow,
} from "../api/topic";
import { useAuthStore } from "../stores/auth";
import { useTopicFollowStore } from "../stores/topicFollow";
import { HOME_NAV } from "../constants/homeNav";
import TopicList from "../components/TopicList.vue";
import QuestionList from "../components/QuestionList.vue";

const router = useRouter();
const authStore = useAuthStore();
const topicFollowStore = useTopicFollowStore();
const footerYear = new Date().getFullYear();

const activeNav = ref(HOME_NAV.QA);
const loading = ref(false);
const list = ref([]);

const headerKeyword = ref("");

const TOPIC_PAGE_SIZE = 20;
const topicList = ref([]);
const topicPage = ref(1);
const topicHasMore = ref(true);
const topicLoading = ref(false);
const topicLoadingMore = ref(false);
const topicKeyword = ref("");
const topicFollowLoadingMap = ref({});

const FOLLOW_QUESTION_PAGE_SIZE = 10;
const followQuestionList = ref([]);
const followQuestionPage = ref(1);
const followQuestionHasMore = ref(true);
const followQuestionLoading = ref(false);
const followQuestionLoadingMore = ref(false);

const followTopicList = ref([]);
const followTopicPage = ref(1);
const followTopicHasMore = ref(true);
const followTopicLoading = ref(false);
const followTopicLoadingMore = ref(false);
const followTopicFollowLoadingMap = ref({});

const isFollowActive = computed(
  () =>
    activeNav.value === HOME_NAV.FOLLOW_QUESTIONS ||
    activeNav.value === HOME_NAV.FOLLOW_TOPICS,
);

const followLabel = computed(() => {
  if (activeNav.value === HOME_NAV.FOLLOW_QUESTIONS) return "关注的问题";
  if (activeNav.value === HOME_NAV.FOLLOW_TOPICS) return "关注的话题";
  return "关注";
});

const handleSelectNav = (key) => {
  activeNav.value = key;
  if (key === HOME_NAV.TOPICS) {
    if (topicKeyword.value) {
      topicKeyword.value = "";
      headerKeyword.value = "";
      fetchTopics({ reset: true });
      return;
    }
    ensureTopicsLoaded();
    return;
  }
  if (key === HOME_NAV.FOLLOW_QUESTIONS) {
    ensureFollowQuestionsLoaded();
    return;
  }
  if (key === HOME_NAV.FOLLOW_TOPICS) {
    ensureFollowTopicsLoaded();
    return;
  }
  if (key !== HOME_NAV.QA) {
    message.info("该模块开发中，当前仅对接问答列表");
  }
};

const handleFetchList = async () => {
  loading.value = true;
  try {
    const data = await fetchQuestionList({ page: 1, size: 10 });
    list.value = data?.results || [];
  } catch (error) {
    // 401 由 http 拦截器统一处理，这里不再重复提示/跳转
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "获取问答列表失败");
    if (!authStore.isLoggedIn) {
      router.push("/auth");
    }
  } finally {
    loading.value = false;
  }
};

const mergeById = (items, incoming) => {
  const map = new Map((items || []).map((t) => [t?.id, t]));
  (incoming || []).forEach((t) => {
    if (!t?.id) return;
    if (map.has(t.id)) {
      map.set(t.id, { ...map.get(t.id), ...t });
    } else {
      map.set(t.id, t);
    }
  });
  return Array.from(map.values());
};

const fetchTopics = async ({ reset } = { reset: false }) => {
  if (topicLoading.value || topicLoadingMore.value) return;
  if (!reset && !topicHasMore.value) return;

  if (reset) {
    topicPage.value = 1;
    topicHasMore.value = true;
    topicList.value = [];
    topicLoading.value = true;
  } else {
    topicLoadingMore.value = true;
  }

  const page = reset ? 1 : topicPage.value + 1;

  try {
    const data = await fetchTopicList({
      page,
      size: TOPIC_PAGE_SIZE,
      search: topicKeyword.value || "",
    });
    const results = topicFollowStore.applyToList(data?.results || []);
    topicList.value = mergeById(topicList.value, results);
    topicPage.value = page;
    topicHasMore.value = Boolean(data?.next);
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "获取话题列表失败");
  } finally {
    topicLoading.value = false;
    topicLoadingMore.value = false;
  }
};

const ensureTopicsLoaded = () => {
  if (topicLoading.value) return;
  if (topicList.value.length > 0) return;
  fetchTopics({ reset: true });
};

const handleLoadMoreTopics = () => {
  fetchTopics({ reset: false });
};

const handleToggleTopicFollow = async (topic) => {
  const id = topic?.id;
  if (!id) return;
  if (topicFollowLoadingMap.value[id]) return;

  const isFollowing = Boolean(topic?.is_following);
  const action = isFollowing ? 2 : 1;

  topicFollowLoadingMap.value = { ...topicFollowLoadingMap.value, [id]: true };
  try {
    await toggleTopicFollow(id, action);

    const delta = action === 1 ? 1 : -1;
    const nextFollowerCount = Math.max(
      0,
      Number(topic.follower_count || 0) + delta,
    );

    topic.is_following = action === 1;
    topic.follower_count = nextFollowerCount;
    topicFollowStore.setTopicState(id, {
      is_following: topic.is_following,
      follower_count: topic.follower_count,
    });
    topicFollowStore.markFollowTopicsDirty();

    message.success(action === 1 ? "已关注" : "已取消关注");
  } catch (error) {
    message.error(error?.message || "操作失败");
  } finally {
    const next = { ...topicFollowLoadingMap.value };
    delete next[id];
    topicFollowLoadingMap.value = next;
  }
};

const fetchFollowQuestions = async ({ reset } = { reset: false }) => {
  if (followQuestionLoading.value || followQuestionLoadingMore.value) return;
  if (!reset && !followQuestionHasMore.value) return;

  if (reset) {
    followQuestionPage.value = 1;
    followQuestionHasMore.value = true;
    followQuestionList.value = [];
    followQuestionLoading.value = true;
  } else {
    followQuestionLoadingMore.value = true;
  }

  const page = reset ? 1 : followQuestionPage.value + 1;

  try {
    const data = await fetchFollowingQuestionList({
      page,
      size: FOLLOW_QUESTION_PAGE_SIZE,
    });
    const results = data?.results || [];
    followQuestionList.value = mergeById(followQuestionList.value, results);
    followQuestionPage.value = page;
    followQuestionHasMore.value = Boolean(data?.next);
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "获取关注的问题失败");
  } finally {
    followQuestionLoading.value = false;
    followQuestionLoadingMore.value = false;
  }
};

const ensureFollowQuestionsLoaded = () => {
  if (followQuestionLoading.value) return;
  if (followQuestionList.value.length > 0) return;
  fetchFollowQuestions({ reset: true });
};

const handleLoadMoreFollowQuestions = () => {
  fetchFollowQuestions({ reset: false });
};

const fetchFollowTopics = async ({ reset } = { reset: false }) => {
  if (followTopicLoading.value || followTopicLoadingMore.value) return;
  if (!reset && !followTopicHasMore.value) return;

  if (reset) {
    followTopicPage.value = 1;
    followTopicHasMore.value = true;
    followTopicList.value = [];
    followTopicLoading.value = true;
  } else {
    followTopicLoadingMore.value = true;
  }

  const page = reset ? 1 : followTopicPage.value + 1;

  try {
    const data = await fetchFollowingTopics({ page, size: TOPIC_PAGE_SIZE });
    const results = topicFollowStore.applyToList(data?.results || []);
    followTopicList.value = mergeById(followTopicList.value, results);
    followTopicPage.value = page;
    followTopicHasMore.value = Boolean(data?.next);
    if (reset) topicFollowStore.clearFollowTopicsDirty();
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "获取关注的话题失败");
  } finally {
    followTopicLoading.value = false;
    followTopicLoadingMore.value = false;
  }
};

const ensureFollowTopicsLoaded = () => {
  if (followTopicLoading.value) return;
  if (followTopicList.value.length > 0 && !topicFollowStore.followTopicsDirty) {
    return;
  }
  fetchFollowTopics({ reset: true });
};

const handleLoadMoreFollowTopics = () => {
  fetchFollowTopics({ reset: false });
};

const handleToggleFollowTopicInFollowTab = async (topic) => {
  const id = topic?.id;
  if (!id) return;
  if (followTopicFollowLoadingMap.value[id]) return;

  const isFollowing = Boolean(topic?.is_following);
  const action = isFollowing ? 2 : 1;

  followTopicFollowLoadingMap.value = {
    ...followTopicFollowLoadingMap.value,
    [id]: true,
  };
  try {
    await toggleTopicFollow(id, action);

    if (action === 2) {
      const nextFollowerCount = Math.max(
        0,
        Number(topic.follower_count || 0) - 1,
      );
      topicFollowStore.setTopicState(id, {
        is_following: false,
        follower_count: nextFollowerCount,
      });

      const hit = topicList.value.find((t) => t?.id === id);
      if (hit) {
        hit.is_following = false;
        hit.follower_count = nextFollowerCount;
      }

      followTopicList.value = followTopicList.value.filter((t) => t?.id !== id);
      message.success("已取消关注");
      return;
    }

    const nextFollowerCount = Math.max(
      0,
      Number(topic.follower_count || 0) + 1,
    );
    topic.is_following = true;
    topic.follower_count = nextFollowerCount;
    topicFollowStore.setTopicState(id, {
      is_following: true,
      follower_count: nextFollowerCount,
    });
    message.success("已关注");
  } catch (error) {
    message.error(error?.message || "操作失败");
  } finally {
    const next = { ...followTopicFollowLoadingMap.value };
    delete next[id];
    followTopicFollowLoadingMap.value = next;
  }
};

const handleHeaderSearch = (keyword) => {
  const value = (keyword || "").trim();
  if (!value) return;

  if (activeNav.value !== HOME_NAV.TOPICS) {
    message.info("搜索当前仅支持话题页");
    return;
  }

  topicKeyword.value = value;
  fetchTopics({ reset: true });
};

watch(headerKeyword, (nextValue, prevValue) => {
  if (activeNav.value !== HOME_NAV.TOPICS) return;
  if (!topicKeyword.value) return;

  const next = (nextValue || "").trim();
  const prev = (prevValue || "").trim();
  if (prev && !next) {
    topicKeyword.value = "";
    fetchTopics({ reset: true });
  }
});

onMounted(() => {
  handleFetchList();
});
</script>

<template>
  <div class="home-page">
    <AppHeader v-model="headerKeyword" @search="handleHeaderSearch" />

    <div class="container">
      <main class="main">
        <div class="content-card">
          <div class="nav-tabs">
            <button class="tab" :class="{ active: activeNav === HOME_NAV.QA }" @click="handleSelectNav(HOME_NAV.QA)">
              问答
            </button>

            <a-dropdown :trigger="['hover']">
              <button
                class="tab follow-tab"
                :class="{ active: isFollowActive }"
                @click="handleSelectNav(HOME_NAV.FOLLOW_QUESTIONS)"
              >
                {{ followLabel }}
                <DownOutlined class="down" />
              </button>
              <template #overlay>
                <a-menu class="follow-menu">
                  <a-menu-item key="follow-questions" :class="[
                    'follow-item',
                    { active: activeNav === HOME_NAV.FOLLOW_QUESTIONS },
                  ]" @click="handleSelectNav(HOME_NAV.FOLLOW_QUESTIONS)">
                    关注的问题
                  </a-menu-item>
                  <a-menu-item key="follow-topics" :class="[
                    'follow-item',
                    { active: activeNav === HOME_NAV.FOLLOW_TOPICS },
                  ]" @click="handleSelectNav(HOME_NAV.FOLLOW_TOPICS)">
                    关注的话题
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>

            <button class="tab" :class="{ active: activeNav === HOME_NAV.TOPICS }"
              @click="handleSelectNav(HOME_NAV.TOPICS)">
              话题
            </button>
          </div>

          <template v-if="activeNav === HOME_NAV.QA">
            <QuestionList :questions="list" :loading="loading" />
          </template>

          <template v-else-if="activeNav === HOME_NAV.FOLLOW_QUESTIONS">
            <QuestionList
              :questions="followQuestionList"
              :loading="followQuestionLoading"
              :loadingMore="followQuestionLoadingMore"
              :hasMore="followQuestionHasMore"
              emptyText="暂无关注的问题"
              @load-more="handleLoadMoreFollowQuestions"
            />
          </template>

          <template v-else-if="activeNav === HOME_NAV.TOPICS">
            <TopicList
              :topics="topicList"
              :loading="topicLoading"
              :loadingMore="topicLoadingMore"
              :hasMore="topicHasMore"
              :followLoadingMap="topicFollowLoadingMap"
              @load-more="handleLoadMoreTopics"
              @toggle-follow="handleToggleTopicFollow"
            />
          </template>

          <template v-else-if="activeNav === HOME_NAV.FOLLOW_TOPICS">
            <TopicList
              :topics="followTopicList"
              :loading="followTopicLoading"
              :loadingMore="followTopicLoadingMore"
              :hasMore="followTopicHasMore"
              :followLoadingMap="followTopicFollowLoadingMap"
              unfollowBehavior="remove"
              emptyText="暂无关注的话题"
              @load-more="handleLoadMoreFollowTopics"
              @toggle-follow="handleToggleFollowTopicInFollowTab"
            />
          </template>

          <template v-else>
            <div class="placeholder">
              <a-empty description="开发中" />
            </div>
          </template>
        </div>
      </main>

      <aside class="aside">
        <a-card class="side-card" :bordered="false">
          <div class="side-brand">
            <div class="badge">乎</div>
            <div class="side-title">
              <div class="name">乎知</div>
              <div class="slogan">有问题，就会有答案</div>
            </div>
          </div>
          <div class="side-desc">
            一个分享知识、经验和见解的专业社区。在这里，你可以找到任何你感兴趣的话题。
          </div>
        </a-card>

        <a-card class="side-card rule-card" :bordered="false">
          <div class="rule">
            请自觉遵守互联网相关的法律法规，严禁发布色情、暴力、反动言论。
          </div>
        </a-card>

        <div class="aside-footer">&copy; {{ footerYear }} 乎知 Huzhi Inc.</div>
      </aside>
    </div>

    <a-back-top class="huzhi-back-top" :visibilityHeight="300" />
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

.home-page {
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

.content-card {
  background: var(--card);
  border-radius: 12px;
  border: 1px solid var(--line);
  overflow: hidden;
}

.nav-tabs {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
}

.tab {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  padding: 10px 6px;
  position: relative;
}

.tab .down {
  margin-left: 6px;
  font-size: 12px;
  color: #94a3b8;
}

.tab.active {
  color: var(--brand-color);
}

.tab.active::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 52px;
  height: 2px;
  background: var(--brand-color);
  transform: translateX(-50%);
  border-radius: 2px;
}

.follow-tab.active {
  color: var(--brand-color) !important;
}

:global(.follow-menu .follow-item.active) {
  color: var(--brand-color) !important;
  font-weight: 600;
}

:global(.follow-menu .follow-item.active .ant-dropdown-menu-title-content) {
  color: var(--brand-color) !important;
}

.follow-tab.active .down {
  color: var(--brand-color);
}

:global(.follow-menu .ant-dropdown-menu-item:hover),
:global(.follow-menu .ant-dropdown-menu-item-active),
:global(.follow-menu .ant-dropdown-menu-item-selected) {
  color: var(--brand-color) !important;
  background: rgba(120, 200, 65, 0.08) !important;
}

:global(.follow-menu .ant-dropdown-menu-item:hover .ant-dropdown-menu-title-content),
:global(.follow-menu .ant-dropdown-menu-item-active .ant-dropdown-menu-title-content),
:global(.follow-menu .ant-dropdown-menu-item-selected .ant-dropdown-menu-title-content) {
  color: var(--brand-color) !important;
}

.feed {
  padding: 0;
}

.placeholder {
  padding: 22px 18px 28px;
}

.feed-item {
  padding: 18px 18px 14px;
}

.feed-item+.feed-item {
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

.aside {
  position: sticky;
  top: 82px;
  height: fit-content;
}

.side-card {
  border-radius: 12px;
  margin-bottom: 14px;
  border: 1px solid var(--line);
}

.side-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.badge {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--brand-color);
  color: #fff;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.side-title .name {
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
  line-height: 1.1;
}

.side-title .slogan {
  margin-top: 2px;
  font-size: 12px;
  color: var(--subtle);
}

.side-desc {
  margin-top: 12px;
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
}

.rule-card {
  background: #f7f7f7;
  border: 1px solid #e5e7eb;
}

.rule {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.7;
}

.aside-footer {
  text-align: center;
  color: #9aa5b1;
  font-size: 12px;
  margin-top: 10px;
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
}
</style>
