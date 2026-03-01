<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { fetchTopicList, createTopic } from "../api/topic";
import { createQuestion } from "../api/question";

const props = defineProps({
  open: { type: Boolean, default: false },
});

const emit = defineEmits(["update:open"]);

const router = useRouter();
const authStore = useAuthStore();
const avatarUrl = computed(() => authStore.avatarUrl);

const rawDraft = ref("");
const splitMode = ref(false);

const title = ref("");
const content = ref("");

const submitting = ref(false);

const titleInputRef = ref(null);
const rawInputRef = ref(null);
const topicSelectRef = ref(null);
const topicPopoverOpen = ref(false);
const selectedTopicIds = ref([]);

const topicSearchOptions = ref([]);
const topicLoading = ref(false);
const creatingTopic = ref(false);
const topicSearchKeyword = ref("");
const topicLabelMap = ref({});

let topicSearchTimer = null;

const hasTitle = computed(() => Boolean(String(title.value || "").trim()));
const canSubmit = computed(() => hasTitle.value && !submitting.value);

const showSplit = computed(() => splitMode.value);

const selectedTopics = computed(() =>
  (selectedTopicIds.value || [])
    .map((id) => String(id))
    .filter((id) => Boolean(id))
    .map((id) => ({
      id,
      name: topicLabelMap.value?.[id] || id,
    })),
);

const close = () => {
  emit("update:open", false);
};

const reset = () => {
  rawDraft.value = "";
  splitMode.value = false;
  title.value = "";
  content.value = "";
  submitting.value = false;

  topicPopoverOpen.value = false;
  selectedTopicIds.value = [];
  topicSearchOptions.value = [];
  topicLoading.value = false;
  creatingTopic.value = false;
  topicSearchKeyword.value = "";
  topicLabelMap.value = {};
};

const splitTextToTitleContent = (text) => {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const nextTitle = String(lines?.[0] || "").trim();
  const rest = lines.slice(1).join("\n");
  // 内容不强行 trim()，保留用户换行；只去掉开头多余空行
  const nextContent = rest.replace(/^\n+/, "");
  return { nextTitle, nextContent };
};

const enterSplitMode = async (text) => {
  if (splitMode.value) return;
  const trimmed = String(text || "").trim();
  if (!trimmed) return;

  const { nextTitle, nextContent } = splitTextToTitleContent(text);
  splitMode.value = true;
  title.value = nextTitle;
  content.value = nextContent;
  rawDraft.value = "";

  await nextTick();
  if (titleInputRef.value?.focus) titleInputRef.value.focus();
};

const maybeExitSplitMode = async () => {
  if (!splitMode.value) return;
  const t = String(title.value || "").trim();
  const c = String(content.value || "").trim();
  const hasTopics = (selectedTopicIds.value || []).length > 0;
  if (t || c || hasTopics) return;

  splitMode.value = false;
  topicPopoverOpen.value = false;
  topicSearchKeyword.value = "";

  await nextTick();
  if (rawInputRef.value?.focus) rawInputRef.value.focus();
};

const setTopicLabelsFromList = (list) => {
  if (!Array.isArray(list)) return;
  const next = { ...(topicLabelMap.value || {}) };
  list.forEach((t) => {
    const id = t?.id;
    if (!id) return;
    next[String(id)] = t?.name || next[String(id)] || "";
  });
  topicLabelMap.value = next;
};

const topicOptionsMerged = computed(() => {
  const search = topicSearchOptions.value || [];
  const map = topicLabelMap.value || {};
  const selected = (selectedTopicIds.value || [])
    .map((id) => String(id))
    .filter((id) => Boolean(id))
    .map((id) => ({
      label: map[id] || id,
      value: id,
    }));

  const merged = [...selected, ...search];
  const seen = new Set();
  return merged.filter((x) => {
    const v = String(x?.value || "");
    if (!v) return false;
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
});

const loadTopics = async (keyword) => {
  const k = String(keyword || "").trim();
  if (!k) {
    // 不输入时不展示列表（符合“搜索后再展示”）
    topicSearchOptions.value = [];
    topicLoading.value = false;
    return;
  }
  if (topicLoading.value) return;
  topicLoading.value = true;
  try {
    const data = await fetchTopicList({
      page: 1,
      size: 20,
      search: k,
    });
    const list = data?.results || [];
    setTopicLabelsFromList(list);
    topicSearchOptions.value = list
      .map((t) => ({
        label: t?.name || "未命名话题",
        value: t?.id,
      }))
      .filter((x) => Boolean(x.value));
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "获取话题失败");
  } finally {
    topicLoading.value = false;
  }
};

const handleTopicSearch = (val) => {
  topicSearchKeyword.value = String(val || "");
  if (topicSearchTimer) clearTimeout(topicSearchTimer);
  topicSearchTimer = setTimeout(() => {
    loadTopics(String(val || "").trim());
  }, 300);
};

const handleCreateTopic = async () => {
  const name = String(topicSearchKeyword.value || "").trim();
  if (!name) {
    message.info("请输入话题名称");
    return;
  }
  if (creatingTopic.value) return;

  creatingTopic.value = true;
  try {
    const created = await createTopic({ name });
    const id = created?.id;
    if (!id) throw new Error("创建话题失败");

    topicLabelMap.value = {
      ...(topicLabelMap.value || {}),
      [String(id)]: created?.name || name,
    };

    const nextSelected = new Set((selectedTopicIds.value || []).map((x) => String(x)));
    nextSelected.add(String(id));
    selectedTopicIds.value = Array.from(nextSelected);

    message.success("话题创建成功");
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "创建话题失败");
  } finally {
    creatingTopic.value = false;
  }
};

const handleToolbarHashClick = () => {
  topicPopoverOpen.value = true;
};

const removeTopic = (id) => {
  const next = (selectedTopicIds.value || []).filter(
    (x) => String(x) !== String(id),
  );
  selectedTopicIds.value = next;
};

const handleSubmit = async () => {
  if (!canSubmit.value) return;
  const t = String(title.value || "").trim();
  if (!t) {
    message.warning("请输入问题标题");
    return;
  }

  submitting.value = true;
  try {
    const created = await createQuestion({
      title: t,
      content: content.value || "",
      topic_ids: selectedTopicIds.value || [],
    });

    const id = created?.id;
    if (!id) throw new Error("发布失败");

    message.success("发布成功");
    close();
    router.push(`/question/${id}`);
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "发布失败");
  } finally {
    submitting.value = false;
  }
};

const handleRawKeydown = async (event) => {
  // 初始态：按 Enter 也允许直接进入“划分态”
  if (event?.key !== "Enter") return;
  if (event?.isComposing) return;
  if (event?.shiftKey) return;
  event.preventDefault();
  await enterSplitMode(rawDraft.value);
};

watch(
  () => props.open,
  async (val) => {
    if (val) {
      reset();
      await nextTick();
      if (rawInputRef.value?.focus) rawInputRef.value.focus();
    } else {
      reset();
    }
  },
);

watch(rawDraft, async (val) => {
  if (!props.open) return;
  if (splitMode.value) return;
  const trimmed = String(val || "").trim();
  if (!trimmed) return;
  await enterSplitMode(val);
});

watch([title, content, selectedTopicIds], () => {
  maybeExitSplitMode();
});

watch(topicPopoverOpen, async (val) => {
  if (!val) return;
  // 打开时不默认加载列表；只做聚焦
  topicSearchOptions.value = [];
  await nextTick();
  if (topicSelectRef.value?.focus) topicSelectRef.value.focus();
});

onBeforeUnmount(() => {
  if (topicSearchTimer) clearTimeout(topicSearchTimer);
  topicSearchTimer = null;
});
</script>

<template>
  <a-modal
    :open="open"
    :width="760"
    centered
    :footer="null"
    :maskClosable="false"
    class="ask-question-modal"
    @cancel="close"
  >
    <div class="ask-modal">
      <div class="ask-body">
        <div class="avatar-col">
          <a-avatar :src="avatarUrl" :size="44" />
        </div>

        <div class="editor-col">
          <template v-if="!showSplit">
            <a-textarea
              ref="rawInputRef"
              v-model:value="rawDraft"
              :auto-size="{ minRows: 8, maxRows: 12 }"
              class="raw-input"
              placeholder="写下你的问题，准确地描述问题更容易得到解答"
              allow-clear
              @keydown="handleRawKeydown"
            />
          </template>

          <template v-else>
            <a-input
              ref="titleInputRef"
              v-model:value="title"
              class="title-input"
              placeholder="我的问题?"
              allow-clear
            />

            <a-textarea
              v-model:value="content"
              :auto-size="{ minRows: 8, maxRows: 12 }"
              class="content-input"
              placeholder=""
              allow-clear
            />
          </template>
        </div>
      </div>

      <div v-if="showSplit" class="topic-hint">
        <template v-if="selectedTopics.length > 0">
          <div class="topic-tags">
            <a-tag
              v-for="t in selectedTopics"
              :key="t.id"
              closable
              @close="removeTopic(t.id)"
            >
              {{ t.name }}
            </a-tag>
          </div>
        </template>
        <div v-else class="topic-hint-text">绑定相关话题可以被更多人看到</div>
      </div>

      <div class="toolbar">
        <a-popover
          v-if="showSplit"
          placement="topLeft"
          trigger="click"
          v-model:open="topicPopoverOpen"
          overlayClassName="ask-topic-popover"
        >
          <template #content>
            <div class="topic-pop">
              <a-select
                ref="topicSelectRef"
                v-model:value="selectedTopicIds"
                mode="multiple"
                show-search
                :filter-option="false"
                :options="topicOptionsMerged"
                :loading="topicLoading"
                placeholder="搜索并选择话题（可多选）"
                style="width: 320px"
                @search="handleTopicSearch"
              >
                <template #notFoundContent>
                  <div class="topic-empty">
                    {{
                      String(topicSearchKeyword || "").trim()
                        ? topicLoading
                          ? "搜索中..."
                          : "未找到相关话题"
                        : "输入话题名称进行搜索"
                    }}
                  </div>
                </template>
                <template #dropdownRender="{ menuNode }">
                  <div>
                    <component :is="menuNode" />
                    <div class="topic-create">
                      <a-button
                        type="link"
                        :disabled="!String(topicSearchKeyword || '').trim()"
                        :loading="creatingTopic"
                        @click="handleCreateTopic"
                      >
                        创建话题：{{
                          String(topicSearchKeyword || "").trim() || "请输入名称"
                        }}
                      </a-button>
                    </div>
                  </div>
                </template>
              </a-select>
            </div>
          </template>

          <button class="tool-btn" type="button" title="绑定话题" @click="handleToolbarHashClick">
            #
          </button>
        </a-popover>

        <div class="toolbar-right">
          <a-button type="primary" :loading="submitting" :disabled="!hasTitle" @click="handleSubmit">
            发布问题
          </a-button>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.ask-question-modal :deep(.ant-modal-content) {
  border-radius: 6px;
}

.ask-question-modal :deep(.ant-modal-body) {
  padding: 0;
}

.ask-modal {
  min-height: 440px;
  padding: 16px 14px 0;
  display: flex;
  flex-direction: column;
}

.ask-body {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-height: 0;
}

.avatar-col {
  flex: none;
  padding-top: 2px;
}

.editor-col {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.raw-input {
  padding: 4px 0 0;
  font-size: 15px;
  line-height: 1.8;
  resize: none;
}

.raw-input :deep(.ant-input) {
  border: none !important;
  box-shadow: none !important;
  padding: 0;
}

.title-input :deep(.ant-input) {
  border: none;
  box-shadow: none;
  border-bottom: 2px solid rgba(148, 163, 184, 0.45);
  border-radius: 0;
  padding: 6px 0 10px;
  font-size: 18px;
  font-weight: 900;
}

.title-input :deep(.ant-input:focus) {
  border-bottom-color: var(--brand-color);
}

.content-input {
  padding: 10px 0 0;
  font-size: 15px;
  line-height: 1.8;
  resize: none;
}

.content-input :deep(.ant-input) {
  border: none !important;
  box-shadow: none !important;
  padding: 0;
}

.topic-hint {
  margin-top: 12px;
  display: flex;
  justify-content: flex-start;
}

.topic-hint-text {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 800;
}

.topic-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.topic-tags :deep(.ant-tag) {
  margin-inline-end: 0;
  border-radius: 999px;
  font-weight: 800;
  color: var(--brand-color);
  border-color: rgba(120, 200, 65, 0.35);
  background: rgba(120, 200, 65, 0.1);
}

.topic-tags :deep(.ant-tag .anticon-close) {
  color: var(--brand-color);
}

.topic-empty {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 800;
  color: #94a3b8;
}

.topic-pop {
  padding: 6px 2px 2px;
}

.topic-create {
  border-top: 1px solid #f0f2f5;
  padding: 6px 10px;
}

.toolbar {
  margin-top: auto;
  padding: 12px 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #f0f2f5;
}

.tool-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: #fff;
  cursor: pointer;
  font-weight: 900;
  color: #334155;
}

.tool-btn:hover {
  border-color: rgba(120, 200, 65, 0.55);
  color: var(--brand-color);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
