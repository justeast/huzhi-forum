<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";
import { FileImageOutlined } from "@ant-design/icons-vue";
import { MdEditor } from "md-editor-v3";
import { useAuthStore } from "../stores/auth";
import { fetchTopicList, createTopic } from "../api/topic";
import { createQuestion } from "../api/question";
import { uploadToCos } from "../utils/cosUploader";

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
const contentEditorRef = ref(null);
const topicSelectRef = ref(null);
const topicPopoverOpen = ref(false);
const selectedTopicIds = ref([]);
const imageInputRef = ref(null);

const imageUploadSession = ref(0);
const imageItems = ref([]);

const topicSearchOptions = ref([]);
const topicLoading = ref(false);
const creatingTopic = ref(false);
const topicSearchKeyword = ref("");
const topicLabelMap = ref({});

let topicSearchTimer = null;

const hasTitle = computed(() => Boolean(String(title.value || "").trim()));
const visibleImages = computed(() =>
  (imageItems.value || []).filter((x) => x && !x.removed),
);
const imageUploadingCount = computed(
  () => visibleImages.value.filter((x) => x.status === "uploading").length,
);
const hasImageErrors = computed(() =>
  visibleImages.value.some((x) => x.status === "error"),
);
const canSubmit = computed(
  () =>
    hasTitle.value &&
    !submitting.value &&
    imageUploadingCount.value === 0 &&
    !hasImageErrors.value,
);

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
  // 递增会话：用于忽略弹窗关闭后的异步回调
  imageUploadSession.value += 1;
  // 清理上传提示，避免关闭弹窗后 toast 残留
  message.destroy("ask_img_upload");
  (imageItems.value || []).forEach((x) => {
    if (!x) return;
    const url = x.blobUrl;
    if (url) URL.revokeObjectURL(url);
  });
  rawDraft.value = "";
  splitMode.value = false;
  title.value = "";
  content.value = "";
  submitting.value = false;
  imageItems.value = [];

  topicPopoverOpen.value = false;
  selectedTopicIds.value = [];
  topicSearchOptions.value = [];
  topicLoading.value = false;
  creatingTopic.value = false;
  topicSearchKeyword.value = "";
  topicLabelMap.value = {};
};

const sanitizeKeyPart = (value) => {
  const raw = String(value || "").trim();
  const safe = raw
    .replace(/[/\\]/g, "_")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || "user";
};

const getFileExt = (file) => {
  const name = String(file?.name || "");
  const dot = name.lastIndexOf(".");
  if (dot > -1 && dot < name.length - 1) {
    const ext = name.slice(dot + 1).trim().toLowerCase();
    if (ext && ext.length <= 10) return ext;
  }

  const type = String(file?.type || "");
  const slash = type.indexOf("/");
  if (slash > -1 && slash < type.length - 1) {
    const ext = type.slice(slash + 1).trim().toLowerCase();
    if (ext && ext.length <= 10) return ext;
  }

  return "png";
};

const genUploadId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};

const escapeRegExp = (str) => String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeLineBreaks = (value) =>
  String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

const removeImageMarkdown = ({ id, url }) => {
  const parts = [];
  if (id) parts.push(`uploading://${String(id)}`);
  if (url) parts.push(String(url));
  if (parts.length === 0) return;

  let next = normalizeLineBreaks(content.value);
  parts.forEach((p) => {
    const re = new RegExp(
      `\\n{0,2}!\\[\\]\\(${escapeRegExp(p)}\\)\\n{0,2}`,
      "g",
    );
    next = next.replace(re, "\n\n");
  });

  // 合并多余空行，避免删除后出现很长的空白
  next = next.replace(/\n{3,}/g, "\n\n");
  content.value = next;
};

const focusContentEditor = async () => {
  await nextTick();
  // md-editor-v3 暴露 focus 方法
  if (contentEditorRef.value?.focus) contentEditorRef.value.focus();
};

const insertAtCursor = async (text) => {
  await focusContentEditor();
  if (contentEditorRef.value?.insert) {
    contentEditorRef.value.insert(() => ({
      targetValue: text,
      select: false,
      deviationStart: 0,
      deviationEnd: 0,
    }));
    return;
  }

  // 兜底：无法调用 insert 时，直接追加到末尾
  content.value = `${content.value || ""}${text}`;
};

const handleToolbarImageClick = async () => {
  if (!showSplit.value) return;
  if (submitting.value) return;
  imageInputRef.value?.click?.();
};

const markUploadToast = () => {
  if (imageUploadingCount.value > 0) {
    // 使用同一个 key 覆盖更新，避免 message 实例异步初始化导致 destroy(key) 丢失
    message.open({
      type: "loading",
      content: "图片上传中...",
      key: "ask_img_upload",
      duration: 0,
    });
    return;
  }
  if (hasImageErrors.value) {
    message.open({
      type: "warning",
      content: "有图片上传失败，请重试或删除",
      key: "ask_img_upload",
      duration: 0,
    });
    return;
  }

  // 没有任何图片时不提示；有图片且都完成时提示成功并自动消失
  if (visibleImages.value.length === 0) {
    message.destroy("ask_img_upload");
    return;
  }

  message.open({
    type: "success",
    content: "图片上传完成",
    key: "ask_img_upload",
    duration: 1,
  });
};

const buildCosKey = (username, file, index) => {
  const safeUser = sanitizeKeyPart(username);
  const ts = Date.now();
  const ext = getFileExt(file);
  return `question/${safeUser}_${ts}_${index}.${ext}`;
};

const uploadImageItem = async ({ session, item, index }) => {
  if (!item) return;
  // 关键：确保对 item 的修改走 Vue 响应式代理，避免 computed（如 imageUploadingCount）不更新
  const reactiveItem = reactive(item);
  if (reactiveItem.removed) return;
  const username = authStore.username || "user";
  const key = buildCosKey(username, reactiveItem.file, index);

  reactiveItem.status = "uploading";
  reactiveItem.errorMessage = "";
  reactiveItem.progress = 0;
  markUploadToast();

  try {
    const res = await uploadToCos(reactiveItem.file, key, {
      onProgress: (p) => {
        if (session !== imageUploadSession.value) return;
        if (reactiveItem.removed) return;
        const percent = Number(p?.percent || 0);
        reactiveItem.progress = Math.max(
          0,
          Math.min(100, Math.round(percent * 100)),
        );
      },
    });
    const url = String(res?.url || "").trim();
    if (!url) throw new Error("图片上传失败");
    if (session !== imageUploadSession.value) return;
    if (reactiveItem.removed) return;

    reactiveItem.cosUrl = url;
    reactiveItem.status = "done";
    reactiveItem.progress = 100;

    const token = `uploading://${reactiveItem.id}`;
    if (String(content.value || "").includes(token)) {
      content.value = String(content.value || "").split(token).join(url);
    }

    // 上传成功后释放本地预览 URL，减少内存占用
    if (reactiveItem.blobUrl) {
      URL.revokeObjectURL(reactiveItem.blobUrl);
      reactiveItem.blobUrl = "";
    }
  } catch (error) {
    if (session !== imageUploadSession.value) return;
    if (reactiveItem.removed) return;
    reactiveItem.status = "error";
    reactiveItem.errorMessage = error?.message || "图片上传失败";
    reactiveItem.progress = 0;
  } finally {
    if (session === imageUploadSession.value) {
      markUploadToast();
    }
  }
};

const handleRemoveImage = (item) => {
  if (!item) return;
  item.removed = true;
  removeImageMarkdown({ id: item.id, url: item.cosUrl });
  if (item.blobUrl) {
    URL.revokeObjectURL(item.blobUrl);
    item.blobUrl = "";
  }
  markUploadToast();
};

const handleRetryImage = async (item) => {
  if (!item || item.removed) return;
  if (submitting.value) return;

  // 如果用户手动删掉了占位符，则重试前补一次占位符，确保替换链路可用
  const token = `uploading://${item.id}`;
  if (!String(content.value || "").includes(token) && !String(item.cosUrl || "")) {
    await insertAtCursor(`\n\n![](${token})\n\n`);
  }

  const session = imageUploadSession.value;
  await uploadImageItem({ session, item, index: 0 });
};

const handleImagesSelected = async (event) => {
  const input = event?.target;
  const files = Array.from(input?.files || []);
  if (input) input.value = "";
  if (!showSplit.value) return;
  if (files.length === 0) return;

  // 仅允许图片
  const images = files.filter((f) => String(f?.type || "").startsWith("image/"));
  if (images.length === 0) {
    message.warning("请选择图片文件");
    return;
  }

  // 允许多张：按选择顺序插入占位符
  const session = imageUploadSession.value;
  const items = images.map((file) => {
    const id = genUploadId();
    return {
      id,
      file,
      blobUrl: URL.createObjectURL(file),
      cosUrl: "",
      status: "uploading",
      progress: 0,
      errorMessage: "",
      removed: false,
    };
  });

  imageItems.value = [...(imageItems.value || []), ...items];

  const insertText = items
    .map((x) => `\n\n![](uploading://${x.id})\n\n`)
    .join("");

  await insertAtCursor(insertText);
  markUploadToast();

  await Promise.all(
    items.map(async (item, index) => {
      await uploadImageItem({ session, item, index });
    }),
  );
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
  if (imageUploadingCount.value > 0) {
    message.info("图片上传中，请稍后再发布");
    return;
  }
  if (hasImageErrors.value) {
    message.info("存在上传失败的图片，请重试或删除后再发布");
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
          <a-textarea
            v-show="!showSplit"
            ref="rawInputRef"
            v-model:value="rawDraft"
            :auto-size="{ minRows: 8, maxRows: 12 }"
            class="raw-input"
            placeholder="写下你的问题，准确地描述问题更容易得到解答"
            allow-clear
            @keydown="handleRawKeydown"
          />

          <div v-show="showSplit" class="split-wrap">
            <a-input
              ref="titleInputRef"
              v-model:value="title"
              class="title-input"
              placeholder="我的问题?"
              allow-clear
            />

            <div v-if="visibleImages.length > 0" class="image-strip">
              <div
                v-for="img in visibleImages"
                :key="img.id"
                class="image-item"
              >
                <img
                  class="image-thumb"
                  :src="img.cosUrl || img.blobUrl"
                  alt="图片预览"
                />

                <button
                  class="image-remove"
                  type="button"
                  title="移除图片"
                  @click="handleRemoveImage(img)"
                >
                  ×
                </button>

                <div v-if="img.status === 'uploading'" class="image-mask">
                  上传中 {{ Number(img.progress || 0) }}%
                </div>

                <div v-else-if="img.status === 'error'" class="image-mask error">
                  <div class="image-error-text">上传失败</div>
                  <button
                    class="image-retry"
                    type="button"
                    @click="handleRetryImage(img)"
                  >
                    重试
                  </button>
                </div>
              </div>
            </div>

            <MdEditor
              ref="contentEditorRef"
              v-model="content"
              class="content-editor"
              :toolbars="[]"
              :footers="[]"
              :preview="false"
              :htmlPreview="false"
              :pageFullscreen="false"
              :noUploadImg="true"
              :noHighlight="true"
              :noKatex="true"
              :noMermaid="true"
              placeholder="补充问题背景、条件等（可选）"
              style="height: 280px"
            />
          </div>
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
        <div v-if="showSplit" class="toolbar-left">
          <a-popover
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

            <button
              class="tool-btn"
              type="button"
              title="绑定话题"
              @click="handleToolbarHashClick"
            >
              #
            </button>
          </a-popover>

          <button
            class="tool-btn icon"
            type="button"
            title="上传相关图片"
            @click="handleToolbarImageClick"
          >
            <FileImageOutlined />
          </button>

          <input
            ref="imageInputRef"
            class="image-input"
            type="file"
            accept="image/*"
            multiple
            @change="handleImagesSelected"
          />
        </div>

        <div class="toolbar-right">
          <a-button
            type="primary"
            :loading="submitting"
            :disabled="!canSubmit"
            @click="handleSubmit"
          >
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

.content-editor {
  margin-top: 10px;
}

.content-editor :deep(.md-editor) {
  border: none;
}

.content-editor :deep(.md-editor-content) {
  background: transparent;
}

.split-wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.image-strip {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.image-item {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 10px;
  border: 1px solid #eef0f3;
  background: #fff;
  overflow: hidden;
  flex: none;
}

.image-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: none;
  background: rgba(15, 23, 42, 0.7);
  color: #fff;
  cursor: pointer;
  line-height: 20px;
  padding: 0;
  font-weight: 900;
}

.image-remove:hover {
  background: rgba(15, 23, 42, 0.85);
}

.image-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  text-align: center;
  padding: 6px;
}

.image-mask.error {
  background: rgba(239, 68, 68, 0.65);
  flex-direction: column;
  gap: 6px;
}

.image-error-text {
  font-size: 12px;
  font-weight: 900;
}

.image-retry {
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
}

.image-retry:hover {
  background: rgba(255, 255, 255, 0.25);
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

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
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

.tool-btn.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 400;
}

.tool-btn:hover {
  border-color: rgba(120, 200, 65, 0.55);
  color: var(--brand-color);
}

.image-input {
  display: none;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
