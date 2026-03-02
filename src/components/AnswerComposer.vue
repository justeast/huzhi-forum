<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { MdEditor } from "md-editor-v3";
import { useAuthStore } from "../stores/auth";
import { createAnswer } from "../api/answer";
import { uploadToCos } from "../utils/cosUploader";

const props = defineProps({
  questionId: { type: String, default: "" },
  // 滚动定位时的顶部偏移（用于避开 AppHeader / 吸顶栏）
  scrollOffset: { type: Number, default: 96 },
});

const emit = defineEmits(["submitted", "draft-change"]);

const authStore = useAuthStore();

// 工具栏：按知乎风格保留常用项（避免默认工具栏过长）
const mdToolbars = [
  "revoke",
  "next",
  "title",
  "bold",
  "underline",
  "italic",
  "strikeThrough",
  "quote",
  "unorderedList",
  "orderedList",
  "task",
  "codeRow",
  "code",
  "link",
  "image",
  "table",
];

const rootRef = ref(null);
const footerRef = ref(null);
const editorRef = ref(null);

const editing = ref(false);
const submitting = ref(false);
const inputMode = ref("markdown"); // markdown | plain

const content = ref("");
const draftUpdatedAt = ref(0);

const uploading = ref(false);
const uploadSession = ref(0);

const footerInView = ref(false);
let footerObserver = null;
let rafId = null;

const stickyRect = ref({ left: 0, width: 0 });

let saveTimer = null;
let hydrating = false;

const draftKey = computed(() => {
  const id = String(props.questionId || "").trim();
  return id ? `huzhi_draft_answer_${id}` : "";
});

const hasDraft = computed(() => Boolean(String(content.value || "").trim()));

watch(
  hasDraft,
  (val) => {
    // 草稿存在与否需要同步到“写回答/编辑回答”按钮文案
    emit("draft-change", Boolean(val));
  },
  { immediate: true },
);

const wordCount = computed(() => {
  const raw = String(content.value || "");
  const normalized = raw.replace(/\s+/g, "");
  return normalized.length;
});

const modeLabel = computed(() =>
  inputMode.value === "plain" ? "纯文本输入中" : "Markdown 语法输入中",
);

const canSubmit = computed(
  () =>
    !submitting.value &&
    !uploading.value &&
    Boolean(String(content.value || "").trim()),
);

const showFixedBar = computed(() => editing.value && !footerInView.value);

const stickyBarStyle = computed(() => {
  const left = Number(stickyRect.value?.left || 0);
  const width = Number(stickyRect.value?.width || 0);
  if (!width) return { left: "0px", width: "100%" };
  return { left: `${left}px`, width: `${width}px` };
});

const safeParseJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const loadDraft = () => {
  const key = draftKey.value;
  hydrating = true;
  try {
    if (!key) {
      content.value = "";
      inputMode.value = "markdown";
      draftUpdatedAt.value = 0;
      return;
    }

    const raw = localStorage.getItem(key);
    if (!raw) {
      content.value = "";
      inputMode.value = "markdown";
      draftUpdatedAt.value = 0;
      return;
    }

    const data = safeParseJson(raw);
    content.value = String(data?.content || "");
    inputMode.value = data?.mode === "plain" ? "plain" : "markdown";
    draftUpdatedAt.value = Number(data?.updatedAt || 0) || 0;
  } finally {
    // 避免 watch 触发立即保存导致覆盖 updatedAt
    setTimeout(() => {
      hydrating = false;
    }, 0);
  }
};

const clearDraft = () => {
  const key = draftKey.value;
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // 忽略
  }
  draftUpdatedAt.value = 0;
};

const saveDraftNow = () => {
  if (hydrating) return;
  const key = draftKey.value;
  if (!key) return;

  const text = String(content.value || "");
  if (!text.trim()) {
    clearDraft();
    return;
  }

  const updatedAt = Date.now();
  draftUpdatedAt.value = updatedAt;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        mode: inputMode.value,
        content: text,
        updatedAt,
      }),
    );
  } catch {
    // localStorage 写入失败时不阻塞用户编辑
  }
};

const scheduleSaveDraft = () => {
  if (hydrating) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDraftNow();
  }, 500);
};

watch(
  () => props.questionId,
  () => {
    editing.value = false;
    submitting.value = false;
    loadDraft();
  },
  { immediate: true },
);

watch([content, inputMode], () => {
  scheduleSaveDraft();
});

const updateStickyRect = () => {
  const el = rootRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth || 0;
  const pad = 12;

  let left = rect.left;
  let width = rect.width;
  if (!vw) return;

  width = Math.min(width, Math.max(0, vw - pad * 2));
  left = Math.max(pad, Math.min(left, vw - pad - width));
  stickyRect.value = { left, width };
};

const scheduleStickyUpdate = async () => {
  await nextTick();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    updateStickyRect();
    rafId = null;
  });
};

const observeFooter = () => {
  if (footerObserver) footerObserver.disconnect();
  footerObserver = null;
  footerInView.value = false;

  if (!editing.value) return;
  if (!footerRef.value) return;
  if (typeof IntersectionObserver === "undefined") return;

  footerObserver = new IntersectionObserver(
    (entries) => {
      footerInView.value = Boolean(entries?.[0]?.isIntersecting);
    },
    {
      root: null,
      threshold: 0,
    },
  );

  footerObserver.observe(footerRef.value);
};

watch(editing, async (val) => {
  if (val) {
    await scheduleStickyUpdate();
  }
  observeFooter();
});

const focusEditor = async () => {
  await nextTick();
  if (inputMode.value === "markdown" && editorRef.value?.focus) {
    editorRef.value.focus();
  }
};

const scrollToComposer = async () => {
  await nextTick();
  const el = rootRef.value;
  if (!el) return;
  const top =
    el.getBoundingClientRect().top +
    (window.pageYOffset || document.documentElement.scrollTop || 0) -
    Number(props.scrollOffset || 0);
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
};

const openAndScroll = async () => {
  if (!String(props.questionId || "").trim()) {
    message.warning("缺少问题ID，无法写回答");
    return;
  }
  editing.value = true;
  await scrollToComposer();
  await focusEditor();
};

const collapse = () => {
  editing.value = false;
  // 收起不清空内容：草稿仍保留
  if (String(content.value || "").trim()) {
    message.info("已为你保存草稿");
  }
};

const handleModeSelect = ({ key }) => {
  const next = String(key || "");
  if (next !== "markdown" && next !== "plain") return;
  inputMode.value = next;
  // 纯文本没有 focus API，切回 markdown 时尝试聚焦
  focusEditor();
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

const buildImageKey = (file) => {
  const userPart = sanitizeKeyPart(authStore.username || "user");
  const qid = sanitizeKeyPart(props.questionId || "question");
  const ext = getFileExt(file);
  const id = genUploadId();
  return `huzhi/answer/${userPart}_${qid}_${id}.${ext}`;
};

const handleUploadImg = async (files, callBack) => {
  if (!files || files.length === 0) {
    callBack([]);
    return;
  }

  const session = (uploadSession.value += 1);
  const list = Array.from(files || []).filter(Boolean);
  const total = list.length;
  if (total === 0) {
    callBack([]);
    return;
  }

  uploading.value = true;
  message.loading({
    key: "answer_img_upload",
    content: `图片上传中 0/${total}`,
    duration: 0,
  });

  try {
    const urls = [];
    let done = 0;

    for (const file of list) {
      const key = buildImageKey(file);
      const res = await uploadToCos(file, key);
      urls.push(res.url);
      done += 1;
      message.loading({
        key: "answer_img_upload",
        content: `图片上传中 ${done}/${total}`,
        duration: 0,
      });
    }

    if (session !== uploadSession.value) return;
    callBack(urls);

    message.success({
      key: "answer_img_upload",
      content: "图片已插入",
      duration: 1.2,
    });
  } catch (error) {
    if (session !== uploadSession.value) return;
    callBack([]);
    message.error({
      key: "answer_img_upload",
      content: error?.message || "图片上传失败",
      duration: 2,
    });
  } finally {
    if (session === uploadSession.value) uploading.value = false;
  }
};

const handleSubmit = async () => {
  if (submitting.value) return;
  const qid = String(props.questionId || "").trim();
  if (!qid) return;

  const text = String(content.value || "");
  if (!text.trim()) {
    message.warning("请输入回答内容");
    return;
  }
  if (uploading.value) {
    message.info("图片上传中，请稍候");
    return;
  }

  submitting.value = true;
  try {
    const created = await createAnswer({
      question_id: qid,
      content: text,
    });

    message.success("回答已发布");
    clearDraft();
    content.value = "";
    inputMode.value = "markdown";
    editing.value = false;
    emit("submitted", created);
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "发布失败");
  } finally {
    submitting.value = false;
  }
};

const handleGotoTop = () => {
  scrollToComposer();
};

const handleWindowResize = () => {
  if (!showFixedBar.value) return;
  scheduleStickyUpdate();
};

onMounted(() => {
  window.addEventListener("resize", handleWindowResize);
  scheduleStickyUpdate();
  observeFooter();
});

onBeforeUnmount(() => {
  if (footerObserver) footerObserver.disconnect();
  footerObserver = null;
  window.removeEventListener("resize", handleWindowResize);
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
});

defineExpose({
  openAndScroll,
});
</script>

<template>
  <section ref="rootRef" class="composer" :class="{ editing }">
    <div v-if="editing" class="card">
      <div class="editor-wrap">
        <div class="editor">
          <MdEditor
            v-if="inputMode === 'markdown'"
            ref="editorRef"
            v-model="content"
            class="md-editor"
            :toolbars="mdToolbars"
            :footers="[]"
            :preview="true"
            :htmlPreview="false"
            :pageFullscreen="false"
            :noUploadImg="false"
            :noHighlight="true"
            :noKatex="true"
            :noMermaid="true"
            inputBoxWidth="50%"
            placeholder="请输入你的回答（支持 Markdown）"
            style="height: 520px"
            @onUploadImg="handleUploadImg"
          />

          <a-textarea
            v-else
            v-model:value="content"
            class="plain-editor"
            placeholder="请输入你的回答（纯文本）"
            :auto-size="{ minRows: 16, maxRows: 26 }"
          />
        </div>

        <div ref="footerRef" class="inline-footer">
          <div class="footer-left">
            <button class="link-btn" type="button" @click="handleGotoTop">
              回到顶部
            </button>
            <span class="meta">字数：{{ wordCount }}</span>
            <span class="meta">
              <template v-if="uploading">图片上传中</template>
              <template v-else>{{ modeLabel }}</template>
            </span>
            <a-dropdown :trigger="['click']" placement="topLeft">
              <button class="link-btn" type="button">修改</button>
              <template #overlay>
                <a-menu @click="handleModeSelect">
                  <a-menu-item key="markdown">Markdown</a-menu-item>
                  <a-menu-item key="plain">纯文本</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>

          <div class="footer-right">
            <button class="collapse-btn" type="button" @click="collapse">
              收起
            </button>
            <a-button
              type="primary"
              :loading="submitting"
              :disabled="!canSubmit"
              @click="handleSubmit"
            >
              发布回答
            </a-button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showFixedBar" class="fixed-footer" :style="stickyBarStyle">
      <div class="footer-left">
        <button class="link-btn" type="button" @click="handleGotoTop">回到顶部</button>
        <span class="meta">字数：{{ wordCount }}</span>
        <span class="meta">
          <template v-if="uploading">图片上传中</template>
          <template v-else>{{ modeLabel }}</template>
        </span>
        <a-dropdown :trigger="['click']" placement="topLeft">
          <button class="link-btn" type="button">修改</button>
          <template #overlay>
            <a-menu @click="handleModeSelect">
              <a-menu-item key="markdown">Markdown</a-menu-item>
              <a-menu-item key="plain">纯文本</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>

      <div class="footer-right">
        <button class="collapse-btn" type="button" @click="collapse">收起</button>
        <a-button
          type="primary"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          发布回答
        </a-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.composer {
  min-width: 0;
  margin-bottom: 0;
}

.composer.editing {
  margin-bottom: 12px;
}

.card {
  background: var(--card);
  border-radius: 8px;
  border: 1px solid var(--line);
  overflow: hidden;
}

.editor-wrap {
  padding: 12px 18px 14px;
}

.editor {
  min-width: 0;
}

.md-editor {
  border: 1px solid #eef0f3;
  border-radius: 10px;
  overflow: hidden;
}

.md-editor :deep(.md-editor-toolbar-wrapper) {
  border-bottom: 1px solid #eef0f3;
}

.plain-editor :global(.ant-input) {
  border-radius: 10px;
  border-color: #eef0f3;
  padding: 12px;
  font-weight: 600;
}

.inline-footer {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.fixed-footer {
  position: fixed;
  bottom: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px 8px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-top: 1px solid #f0f2f5;
  box-shadow: 0 -10px 24px rgba(15, 23, 42, 0.06);
}

.footer-left {
  min-width: 0;
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.footer-right {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.meta {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.link-btn {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: #64748b;
  font-weight: 900;
  font-size: 12px;
}

.link-btn:hover {
  color: var(--brand-color);
}

.collapse-btn {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: #64748b;
  font-weight: 900;
  font-size: 12px;
}

.collapse-btn:hover {
  color: var(--brand-color);
}

@media (max-width: 1100px) {
  .fixed-footer {
    padding: 10px 12px 8px;
  }
}
</style>
