<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { MdEditor } from "md-editor-v3";
import { updateAnswer } from "../api/answer";
import { uploadToCos } from "../utils/cosUploader";

const props = defineProps({
  open: { type: Boolean, default: false },
  answerId: { type: String, default: "" },
  initialContent: { type: String, default: "" },
  questionTitle: { type: String, default: "" },
});

const emit = defineEmits(["update:open", "submitted"]);

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

const editorRef = ref(null);
const content = ref("");
const submitting = ref(false);
const uploading = ref(false);
const uploadSession = ref(0);

const canSubmit = computed(
  () => !submitting.value && !uploading.value && Boolean(String(content.value || "").trim()),
);

const reset = () => {
  uploadSession.value += 1;
  message.destroy("edit_answer_img_upload");
  content.value = "";
  submitting.value = false;
  uploading.value = false;
};

const close = () => {
  emit("update:open", false);
};

const sanitizeKeyPart = (value) => {
  const raw = String(value || "").trim();
  const safe = raw
    .replace(/[/\\]/g, "_")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || "answer";
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

const buildImageKey = (file) => {
  const aid = sanitizeKeyPart(props.answerId || "answer");
  const ext = getFileExt(file);
  const stamp = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  return `forum/answer/${aid}/${stamp}.${ext}`;
};

const focusEditor = async () => {
  await nextTick();
  if (editorRef.value?.focus) editorRef.value.focus();
};

const handleUploadImg = async (files, callBack) => {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (list.length === 0) {
    callBack([]);
    return;
  }

  const session = (uploadSession.value += 1);
  const total = list.length;
  uploading.value = true;
  message.loading({
    key: "edit_answer_img_upload",
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
        key: "edit_answer_img_upload",
        content: `图片上传中 ${done}/${total}`,
        duration: 0,
      });
    }

    if (session !== uploadSession.value) return;
    callBack(urls);
    message.success({
      key: "edit_answer_img_upload",
      content: "图片已插入",
      duration: 1.2,
    });
  } catch (error) {
    if (session !== uploadSession.value) return;
    callBack([]);
    message.error({
      key: "edit_answer_img_upload",
      content: error?.message || "图片上传失败",
      duration: 2,
    });
  } finally {
    if (session === uploadSession.value) uploading.value = false;
  }
};

const handleSubmit = async () => {
  const id = String(props.answerId || "").trim();
  const text = String(content.value || "");

  if (!id) {
    message.warning("缺少回答ID");
    return;
  }
  if (!text.trim()) {
    message.warning("请输入回答内容");
    return;
  }
  if (uploading.value) {
    message.info("图片上传中，请稍后再保存");
    return;
  }

  submitting.value = true;
  try {
    const updated = await updateAnswer(id, { content: text });
    message.success("回答已更新");
    emit("submitted", updated);
    close();
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "保存失败");
  } finally {
    submitting.value = false;
  }
};

watch(
  () => props.open,
  async (open) => {
    if (open) {
      reset();
      content.value = String(props.initialContent || "");
      await focusEditor();
      return;
    }
    reset();
  },
);
</script>

<template>
  <a-modal
    :open="open"
    :width="1120"
    centered
    :maskClosable="false"
    :footer="null"
    class="edit-answer-modal"
    @cancel="close"
  >
    <div class="edit-answer-wrap">
      <div class="header">
        <div class="title">编辑回答</div>
        <div v-if="questionTitle" class="subtitle">问题：{{ questionTitle }}</div>
      </div>

      <MdEditor
        ref="editorRef"
        v-model="content"
        class="editor"
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
        style="height: 560px"
        @onUploadImg="handleUploadImg"
      />

      <div class="footer">
        <div class="meta">
          <span v-if="uploading">图片上传中...</span>
          <span v-else>支持 Markdown 与图片上传</span>
        </div>

        <div class="actions">
          <a-button @click="close">取消</a-button>
          <a-button type="primary" :loading="submitting" :disabled="!canSubmit" @click="handleSubmit">
            保存修改
          </a-button>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.edit-answer-modal :deep(.ant-modal-body) {
  padding: 16px 18px 18px;
}

.edit-answer-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.title {
  font-size: 18px;
  font-weight: 800;
  color: #111827;
}

.subtitle {
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
}

.editor :deep(.md-editor) {
  border-radius: 10px;
  overflow: hidden;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.meta {
  font-size: 13px;
  color: #64748b;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
