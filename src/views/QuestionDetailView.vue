<script setup>
import { computed, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { DownOutlined } from "@ant-design/icons-vue";
import { useRoute } from "vue-router";
import AppHeader from "../components/AppHeader.vue";
import QuestionDetailHeader from "../components/QuestionDetailHeader.vue";
import AnswerFeed from "../components/AnswerFeed.vue";
import AuthorCard from "../components/AuthorCard.vue";
import { fetchQuestionDetail } from "../api/question";
import { fetchAnswerList } from "../api/answer";
import { fetchUserCard } from "../api/user";
import { formatCount } from "../utils/format";

const route = useRoute();

const headerKeyword = ref("");
const handleHeaderSearch = () => {
  message.info("该页面暂不支持搜索，请在首页进行搜索");
};

const questionId = computed(() => String(route.params?.id || ""));

const question = ref(null);
const questionLoading = ref(false);

const answers = ref([]);
const answerLoading = ref(false);
const answerLoadingMore = ref(false);
const answerHasMore = ref(true);
const answerPage = ref(1);
const ANSWER_PAGE_SIZE = 10;

const firstAnswer = computed(() => answers.value?.[0] || null);

const author = ref(null);
const authorLoading = ref(false);

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

let loadSeq = 0;
const loadQuestionAndAnswers = async (id) => {
  const seq = (loadSeq += 1);
  question.value = null;
  answers.value = [];
  author.value = null;
  answerPage.value = 1;
  answerHasMore.value = true;

  questionLoading.value = true;
  answerLoading.value = true;

  try {
    const [questionData, answerData] = await Promise.all([
      fetchQuestionDetail(id),
      fetchAnswerList({ question: id, page: 1, size: ANSWER_PAGE_SIZE }),
    ]);

    if (seq !== loadSeq) return;

    question.value = questionData;
    answers.value = answerData?.results || [];
    answerHasMore.value = Boolean(answerData?.next);
    answerPage.value = 1;
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "加载问题详情失败");
  } finally {
    if (seq === loadSeq) {
      questionLoading.value = false;
      answerLoading.value = false;
    }
  }
};

const loadMoreAnswers = async () => {
  if (answerLoading.value || answerLoadingMore.value) return;
  if (!answerHasMore.value) return;
  const id = questionId.value;
  if (!id) return;

  answerLoadingMore.value = true;
  const page = answerPage.value + 1;

  try {
    const data = await fetchAnswerList({
      question: id,
      page,
      size: ANSWER_PAGE_SIZE,
    });
    const results = data?.results || [];
    answers.value = mergeById(answers.value, results);
    answerHasMore.value = Boolean(data?.next);
    answerPage.value = page;
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "加载更多回答失败");
  } finally {
    answerLoadingMore.value = false;
  }
};

let userCardSeq = 0;
watch(
  () => firstAnswer.value?.respondent?.id,
  async (userId) => {
    author.value = null;
    if (!userId) return;

    const seq = (userCardSeq += 1);
    authorLoading.value = true;

    try {
      const data = await fetchUserCard(userId);
      if (seq !== userCardSeq) return;
      author.value = data;
    } catch (error) {
      if (error?.__handled401) return;
      message.error(error?.message || "获取作者信息失败");
    } finally {
      if (seq === userCardSeq) authorLoading.value = false;
    }
  },
  { immediate: true },
);

watch(
  questionId,
  (id) => {
    if (!id) return;
    loadQuestionAndAnswers(id);
  },
  { immediate: true },
);

const handleSortClick = () => {
  message.info("排序功能开发中");
};

const answerTotalText = computed(() => {
  const total = question.value?.answer_count ?? answers.value?.length ?? 0;
  const num = Math.max(0, Number(total || 0));
  return `${num} 个回答`;
});
</script>

<template>
  <div class="qd-page">
    <AppHeader v-model="headerKeyword" @search="handleHeaderSearch" />

    <div class="container">
      <QuestionDetailHeader :question="question" :loading="questionLoading" />

      <section class="answer-grid">
        <div class="left">
          <div class="answers-head">
            <div class="answers-title">
              {{ answerTotalText }}
            </div>

            <button class="sort-btn" type="button" @click="handleSortClick">
              <span>默认排序</span>
              <DownOutlined class="down" />
            </button>
          </div>

          <div class="answers-body">
            <AnswerFeed
              :answers="answers"
              :loading="answerLoading"
              :loadingMore="answerLoadingMore"
              :hasMore="answerHasMore"
              emptyText="暂无回答"
              @load-more="loadMoreAnswers"
            />
          </div>
        </div>

        <aside class="aside">
          <a-card class="side-card" :bordered="false">
            <div class="side-title">关于作者</div>
            <div v-if="firstAnswer" class="side-body">
              <AuthorCard :user="author" :loading="authorLoading" />
            </div>
            <a-empty v-else description="暂无回答" />
          </a-card>

          <a-card
            v-if="firstAnswer"
            class="side-card collected-card"
            :bordered="false"
          >
            <div class="side-title">该回答已被收藏</div>
            <div class="collected">
              <div class="collected-value">
                {{ formatCount(firstAnswer?.collected_count || 0) }}
              </div>
              <div class="collected-unit">次</div>
            </div>
          </a-card>
        </aside>
      </section>
    </div>
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

.qd-page {
  min-height: 100vh;
  background: var(--bg);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px 60px;
  min-width: 0;
}

.answer-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
  align-items: start;
}

.left {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.answers-head {
  background: var(--card);
  border-radius: 8px;
  border: 1px solid var(--line);
  overflow: hidden;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.answers-title {
  font-size: 18px;
  font-weight: 900;
  color: #111827;
}

.answers-body {
  background: var(--card);
  border-radius: 8px;
  border: 1px solid var(--line);
  overflow: hidden;
  padding: 0;
}

.sort-btn {
  border: 1px solid rgba(148, 163, 184, 0.32);
  background: #fff;
  color: #64748b;
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.sort-btn:hover {
  border-color: rgba(120, 200, 65, 0.5);
  color: var(--brand-color);
}

.down {
  font-size: 12px;
  color: currentColor;
}

.aside {
  position: sticky;
  top: 82px;
  height: fit-content;
}

.side-card {
  border-radius: 8px;
  border: 1px solid var(--line);
}

.side-card + .side-card {
  margin-top: 14px;
}

.side-title {
  font-size: 15px;
  font-weight: 900;
  color: #111827;
  margin-bottom: 12px;
}

.collected-card .side-title {
  margin-bottom: 10px;
}

.collected {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.collected-value {
  font-size: 30px;
  font-weight: 900;
  color: #111827;
  line-height: 1.1;
}

.collected-unit {
  font-size: 13px;
  font-weight: 800;
  color: #94a3b8;
}

@media (max-width: 1100px) {
  .answer-grid {
    grid-template-columns: 1fr;
  }

  .aside {
    position: static;
  }
}
</style>
