<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({
  questions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  emptyText: { type: String, default: "暂无关注的问题" },
});

const emit = defineEmits(["load-more", "item-click"]);

const sentinelRef = ref(null);
let observer = null;

const showEmpty = computed(() => !props.loading && props.questions.length === 0);

const canLoadMore = computed(
  // 列表为空时不触发自动 load-more，避免“首屏未加载就先翻页”的请求
  () =>
    props.questions.length > 0 &&
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

const formatAnswerCount = (value) => {
  const num = Math.max(0, Number(value || 0));
  return `${num} 个回答`;
};

const handleClickItem = (item) => {
  emit("item-click", item);
};
</script>

<template>
  <div class="follow-question-list">
    <a-spin :spinning="loading">
      <a-empty v-if="showEmpty" :description="emptyText" />

      <div v-else class="list">
        <div
          v-for="item in questions"
          :key="item.id"
          class="row"
          role="button"
          tabindex="0"
          @click="handleClickItem(item)"
        >
          <div class="title">{{ item?.title }}</div>
          <div class="right">{{ formatAnswerCount(item?.answer_count) }}</div>
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
.follow-question-list {
  padding: 0;
}

.list {
  padding: 0;
}

.row {
  padding: 16px 18px;
  cursor: pointer;
  transition: background 0.18s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.row + .row {
  border-top: 1px solid #f0f2f5;
}

.row:hover {
  background: rgba(120, 200, 65, 0.06);
}

.title {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
  line-height: 1.45;
  transition: color 0.18s ease;
  min-width: 0;
  flex: 1;
}

.row:hover .title {
  color: var(--brand-color);
}

.right {
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
