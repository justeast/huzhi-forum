<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import { SearchOutlined } from "@ant-design/icons-vue";
import { fetchQuestionList } from "../api/question";
import { useAuthStore } from "../stores/auth";
import { formatCount, formatDateTimeMinute } from "../utils/format";

const props = defineProps({
  open: { type: Boolean, default: false },
});

const emit = defineEmits(["update:open"]);

const router = useRouter();
const authStore = useAuthStore();

const searchInputRef = ref(null);
const keyword = ref("");
const list = ref([]);
const page = ref(1);
const hasMore = ref(true);
const loading = ref(false);
const loadingMore = ref(false);

let searchTimer = null;
let loadSeq = 0;

const PAGE_SIZE = 8;
const defaultAvatar = "/default-avatar.png";

const trimmedKeyword = computed(() => String(keyword.value || "").trim());
const isSearching = computed(() => Boolean(trimmedKeyword.value));
const titleText = computed(() => (isSearching.value ? "搜索结果" : "推荐问题"));
const emptyText = computed(() =>
  isSearching.value ? "暂无匹配的问题，换个关键词试试" : "暂无可推荐的问题",
);

const buildParams = (targetPage) => ({
  page: targetPage,
  size: PAGE_SIZE,
  search: trimmedKeyword.value || undefined,
  scene: trimmedKeyword.value ? undefined : "answer_recommend",
});

const resetState = () => {
  keyword.value = "";
  list.value = [];
  page.value = 1;
  hasMore.value = true;
  loading.value = false;
  loadingMore.value = false;
  loadSeq += 1;
};

const close = () => {
  emit("update:open", false);
};

const mergeById = (source, incoming) => {
  const map = new Map();
  (source || []).forEach((item) => {
    if (item?.id) map.set(String(item.id), item);
  });
  (incoming || []).forEach((item) => {
    if (item?.id) map.set(String(item.id), item);
  });
  return Array.from(map.values());
};

const loadQuestions = async ({ reset = false } = {}) => {
  if (!props.open) return;
  if (reset) {
    loading.value = true;
  } else {
    if (loading.value || loadingMore.value || !hasMore.value) return;
    loadingMore.value = true;
  }

  const nextPage = reset ? 1 : page.value + 1;
  const seq = ++loadSeq;

  try {
    const data = await fetchQuestionList(buildParams(nextPage));
    if (seq !== loadSeq) return;
    const results = data?.results || [];
    list.value = reset ? results : mergeById(list.value, results);
    page.value = nextPage;
    hasMore.value = Boolean(data?.next);
  } catch (error) {
    if (seq !== loadSeq) return;
    if (error?.__handled401) return;
    message.error(error?.message || "获取可回答问题失败");
  } finally {
    if (seq === loadSeq) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
};

const scheduleSearch = () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadQuestions({ reset: true });
  }, 250);
};

const handleSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
  loadQuestions({ reset: true });
};

const handleLoadMore = () => {
  loadQuestions({ reset: false });
};

const handleUserClick = (userId) => {
  const id = String(userId || "").trim();
  if (!id) return;
  close();
  if (id === String(authStore.userId || "").trim()) {
    router.push("/profile");
    return;
  }
  router.push(`/user/${id}`);
};

const handleAnswer = (questionId) => {
  const id = String(questionId || "").trim();
  if (!id) return;
  close();
  router.push({
    path: `/question/${id}`,
    query: { compose: "1" },
  });
};

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      resetState();
      return;
    }
    await nextTick();
    searchInputRef.value?.focus?.();
    loadQuestions({ reset: true });
  },
);

watch(keyword, () => {
  if (!props.open) return;
  scheduleSearch();
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <a-modal
    :open="props.open"
    width="880px"
    title="写回答"
    :footer="null"
    :maskClosable="true"
    @cancel="close"
  >
    <div class="picker-modal">
      <div class="picker-search">
        <a-input
          ref="searchInputRef"
          v-model:value="keyword"
          size="large"
          allow-clear
          name="answer-question-search"
          placeholder="搜索你想回答的问题"
          @pressEnter="handleSearch"
        >
          <template #suffix>
            <SearchOutlined class="search-icon" @click="handleSearch" />
          </template>
        </a-input>
      </div>

      <div class="picker-head">
        <span class="picker-title">{{ titleText }}</span>
        <span class="picker-subtitle">
          {{ isSearching ? `共找到 ${list.length} 条当前结果` : "选择一个问题开始回答" }}
        </span>
      </div>

      <a-spin :spinning="loading">
        <a-list
          class="picker-list"
          item-layout="vertical"
          :data-source="list"
          :locale="{ emptyText }"
        >
          <template #renderItem="{ item }">
            <a-list-item class="picker-item">
              <div class="picker-card">
                <div class="picker-main">
                  <button
                    class="question-title"
                    type="button"
                    :title="item?.title || ''"
                    @click="handleAnswer(item?.id)"
                  >
                    {{ item?.title || "未命名问题" }}
                  </button>

                  <div class="question-meta">
                    <button
                      class="questioner"
                      type="button"
                      @click.stop="handleUserClick(item?.questioner?.id)"
                    >
                      <a-avatar :src="item?.questioner?.avatar || defaultAvatar" :size="32" />
                      <span class="questioner-name">{{ item?.questioner?.username || "未知用户" }}</span>
                    </button>

                    <span class="meta-text">{{ formatCount(item?.answer_count) }} 个回答</span>
                    <span class="meta-text">{{ formatCount(item?.follower_count) }} 人关注</span>
                    <span class="meta-text">{{ formatDateTimeMinute(item?.created) }}</span>
                  </div>

                  <div v-if="item?.topics?.length" class="topic-list">
                    <a-tag v-for="topic in item.topics" :key="topic.id" class="topic-tag">
                      {{ topic.name }}
                    </a-tag>
                  </div>
                </div>

                <div class="picker-side">
                  <a-button type="primary" @click="handleAnswer(item?.id)">回答</a-button>
                </div>
              </div>
            </a-list-item>
          </template>
        </a-list>
      </a-spin>

      <div v-if="hasMore && list.length" class="picker-more">
        <a-button :loading="loadingMore" @click="handleLoadMore">加载更多</a-button>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.picker-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.picker-search :deep(.ant-input-affix-wrapper) {
  border-radius: 12px;
}

.search-icon {
  color: #94a3b8;
  cursor: pointer;
}

.search-icon:hover {
  color: var(--brand-color);
}

.picker-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.picker-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.picker-subtitle {
  font-size: 12px;
  color: #94a3b8;
}

.picker-list :deep(.ant-list-items) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.picker-list :deep(.ant-list-item) {
  padding: 0;
  border: none;
}

.picker-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
  border: 1px solid #eef0f3;
  border-radius: 14px;
  background: #fff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.picker-card:hover {
  border-color: rgba(120, 200, 65, 0.45);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.picker-main {
  min-width: 0;
  flex: 1;
}

.question-title {
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.5;
}

.question-title:hover {
  color: var(--brand-color);
}

.question-meta {
  margin-top: 12px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 14px;
}

.questioner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.questioner-name {
  color: #334155;
  font-size: 14px;
  font-weight: 600;
}

.questioner:hover .questioner-name {
  color: var(--brand-color);
}

.meta-text {
  color: #94a3b8;
  font-size: 13px;
}

.topic-list {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.topic-tag {
  margin: 0;
  color: var(--brand-color);
  border-color: rgba(120, 200, 65, 0.24);
  background: rgba(120, 200, 65, 0.08);
}

.picker-side {
  flex: none;
  display: inline-flex;
  align-items: center;
}

.picker-more {
  display: flex;
  justify-content: center;
  padding-top: 4px;
}

@media (max-width: 760px) {
  .picker-card {
    flex-direction: column;
    align-items: stretch;
  }

  .picker-side {
    justify-content: flex-end;
  }

  .picker-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
