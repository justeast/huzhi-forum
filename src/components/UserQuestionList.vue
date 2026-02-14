<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { formatDateTimeMinute } from "../utils/format";

const props = defineProps({
  questions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  emptyText: { type: String, default: "暂无提问" },
});

const emit = defineEmits(["load-more", "item-click"]);

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

const formatAnswerTag = (value) => `${Math.max(0, Number(value || 0))} 个回答`;
const formatFollowTag = (value) => `${Math.max(0, Number(value || 0))} 人关注`;

const handleClickItem = (item) => {
  emit("item-click", item);
};
</script>

<template>
  <div class="user-question-list">
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
          <div class="left">
            <div class="title">{{ item?.title }}</div>
            <div class="tags">
              <span class="tag tag-answer">{{ formatAnswerTag(item?.answer_count) }}</span>
              <span class="tag">{{ formatFollowTag(item?.follower_count) }}</span>
            </div>
          </div>
          <div class="time">{{ formatDateTimeMinute(item?.created) }}</div>
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
.user-question-list {
  padding: 0;
}

.list {
  padding: 0;
}

.row {
  padding: 18px 18px 16px;
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

.left {
  min-width: 0;
  flex: 1;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #111827;
  line-height: 1.35;
  transition: color 0.18s ease;
}

.row:hover .title {
  color: var(--brand-color);
}

.tags {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-weight: 800;
  font-size: 12px;
  white-space: nowrap;
}

.tag-answer {
  background: rgba(120, 200, 65, 0.12);
  border-color: rgba(120, 200, 65, 0.22);
  color: var(--brand-color);
}

.time {
  color: #94a3b8;
  font-weight: 700;
  font-size: 13px;
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

