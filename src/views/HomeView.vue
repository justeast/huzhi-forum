<script setup>
import { computed, onMounted, ref } from "vue";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";
import {
  CommentOutlined,
  LikeFilled,
  StarOutlined,
  DownOutlined,
} from "@ant-design/icons-vue";
import AppHeader from "../components/AppHeader.vue";
import { fetchQuestionList } from "../api/question";
import { useAuthStore } from "../stores/auth";
import { VOTE_STATUS } from "../constants/vote";

const router = useRouter();
const authStore = useAuthStore();
const footerYear = new Date().getFullYear();

const activeNav = ref("qa");
const loading = ref(false);
const list = ref([]);

const followLabel = computed(() => {
  if (activeNav.value === "follow-questions") return "关注的问题";
  if (activeNav.value === "follow-topics") return "关注的话题";
  return "关注";
});

const handleSelectNav = (key) => {
  activeNav.value = key;
  if (key !== "qa") {
    message.info("该模块开发中，当前仅对接问答列表");
  }
};

const toPreviewText = (text, max = 160) => {
  const value = (text || "").trim().replace(/\s+/g, " ");
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max)}...` : value;
};

// 数字格式化：如 1200 -> 1.2k
const formatCount = (value) => {
  const num = Number(value) || 0;
  if (num < 1000) return `${num}`;
  const k = (num / 1000).toFixed(1).replace(/\.0$/, "");
  return `${k}k`;
};

const handleCollectAnswer = () => {
  message.info("收藏功能开发中");
};

// 当前用户是否已对该回答“赞同”（接口字段 user_vote_status：见 VOTE_STATUS）
const isUpvoted = (status) => Number(status) === VOTE_STATUS.UPVOTE;

const handleFetchList = async () => {
  loading.value = true;
  try {
    const data = await fetchQuestionList({ page: 1, size: 10 });
    list.value = data?.results || [];
  } catch (error) {
    message.error(error?.message || "获取问答列表失败");
    if (!authStore.isLoggedIn) {
      router.push("/auth");
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  handleFetchList();
});
</script>

<template>
  <div class="home-page">
    <AppHeader />

    <div class="container">
      <main class="main">
        <div class="content-card">
          <div class="nav-tabs">
            <button class="tab" :class="{ active: activeNav === 'qa' }" @click="handleSelectNav('qa')">
              问答
            </button>

            <a-dropdown :trigger="['hover']">
              <button class="tab follow-tab" :class="{ active: activeNav.startsWith('follow') }">
                {{ followLabel }}
                <DownOutlined class="down" />
              </button>
              <template #overlay>
                <a-menu class="follow-menu">
                  <a-menu-item key="follow-questions" :class="[
                    'follow-item',
                    { active: activeNav === 'follow-questions' },
                  ]" @click="handleSelectNav('follow-questions')">
                    关注的问题
                  </a-menu-item>
                  <a-menu-item key="follow-topics" :class="[
                    'follow-item',
                    { active: activeNav === 'follow-topics' },
                  ]" @click="handleSelectNav('follow-topics')">
                    关注的话题
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>

            <button class="tab" :class="{ active: activeNav === 'topics' }" @click="handleSelectNav('topics')">
              话题
            </button>
          </div>

          <a-spin :spinning="loading">
            <div class="feed">
              <a-empty v-if="!loading && list.length === 0" description="暂无内容" />

              <div v-for="item in list" :key="item.id" class="feed-item">
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

                  <button class="action-meta link" type="button" @click="handleCollectAnswer">
                    <StarOutlined />
                    <span class="action-text">收藏</span>
                  </button>
                </div>
              </div>
            </div>
          </a-spin>
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
