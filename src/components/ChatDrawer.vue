<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { message as antdMessage } from "ant-design-vue";
import { useRouter } from "vue-router";
import {
  CloseOutlined,
  FileImageOutlined,
  LoadingOutlined,
  SendOutlined,
} from "@ant-design/icons-vue";
import { uploadToCos } from "../utils/cosUploader";
import { useAuthStore } from "../stores/auth";
import { useChatStore } from "../stores/chat";
import { formatDateTimeMinute } from "../utils/format";

const authStore = useAuthStore();
const chatStore = useChatStore();
const router = useRouter();
const {
  drawerOpen,
  activeChatId,
  chatList,
  chatListLoading,
  chatListLoadingMore,
  chatListHasMore,
  totalUnread,
  wsStatus,
  messageStateMap,
  chatMetaMap,
  sendingText,
  sendingImageCount,
  isSendLimited,
} = storeToRefs(chatStore);

const composerText = ref("");
const fileInputRef = ref(null);
const listWrapRef = ref(null);
const msgWrapRef = ref(null);

// 上传队列：用于展示图片缩略图与进度（上传成功后会自动发送为图片消息）
const uploads = ref([]);
let uploadSession = 0;

const activeChat = computed(() =>
  (chatList.value || []).find((c) => String(c?.id) === String(activeChatId.value)),
);
const activeOtherUser = computed(() => activeChat.value?.other_user || null);

const activeMessagesState = computed(() => messageStateMap.value?.[activeChatId.value] || null);
const activeMessages = computed(() => activeMessagesState.value?.items || []);

const wsStatusText = computed(() => {
  const s = String(wsStatus.value || "").toUpperCase();
  if (s === "OPEN") return "已连接";
  if (s === "CONNECTING") return "连接中";
  return "未连接";
});

const showWsText = computed(() => String(wsStatus.value || "").toUpperCase() !== "OPEN");

const canPickImage = computed(() => {
  if (!authStore.isLoggedIn) return false;
  if (!activeChatId.value) return false;
  if (sendingImageCount.value > 0) return false;
  if (isSendLimited.value) return false;
  return true;
});

const canSendText = computed(() => {
  const text = String(composerText.value || "").trim();
  if (!text) return false;
  if (!authStore.isLoggedIn) return false;
  if (!activeChatId.value) return false;
  if (sendingText.value) return false;
  if (sendingImageCount.value > 0) return false;
  if (isSendLimited.value) return false;
  return true;
});

const isSendLimitedForChat = (chatId) => Boolean(chatMetaMap.value?.[String(chatId)]?.sendLimited);

const scrollToBottom = async () => {
  await nextTick();
  const el = msgWrapRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
};

watch(
  () => drawerOpen.value,
  async (open) => {
    if (!open) return;
    await chatStore.loadChatList();
    const id = activeChatId.value;
    if (!id) return;
    // 若该会话已加载过历史消息，则不再重复调用 openChatById，避免重复请求
    if (!activeMessagesState.value?.loaded) {
      await chatStore.openChatById(id);
    } else {
      await chatStore.markReadSilently(id);
      // 抽屉打开时也刷新一次互关状态，避免“互关变化”但未重新选中会话导致标识不更新
      await chatStore.ensureChatMetaLoadedWithOptions(id, { force: true });
      chatStore.recomputeSendLimited(id);
    }
    await scrollToBottom();
  },
);

watch(
  () => activeMessages.value.length,
  async () => {
    if (!drawerOpen.value) return;
    if (!activeChatId.value) return;
    await scrollToBottom();
  },
);

const handleClose = () => {
  drawerOpen.value = false;
};

const handleSelectChat = async (id) => {
  if (sendingImageCount.value > 0) {
    antdMessage.info("图片上传中，暂不可切换会话");
    return;
  }
  if (!id) return;
  await chatStore.openChatById(id);
  await scrollToBottom();
};

const handleMarkAllRead = async () => {
  const before = Number(totalUnread.value || 0);
  if (before <= 0) {
    antdMessage.info("暂无未读消息");
    return;
  }
  await chatStore.markAllChatsRead();
  antdMessage.success("已清除未读");
};

const gotoUserProfile = (user) => {
  const uid = String(user?.id || "").trim();
  if (!uid) return;
  const selfId = String(authStore.userId || "").trim();
  const path = uid === selfId ? "/profile" : `/user/${uid}`;
  router.push(path);
  // 导航后关闭抽屉，避免遮挡新页面
  drawerOpen.value = false;
};

const handlePickImage = () => {
  if (!activeChatId.value) return;
  if (!canPickImage.value) {
    antdMessage.info(isSendLimited.value ? "等待对方回复后可继续发送" : "图片上传中，请稍候");
    return;
  }
  fileInputRef.value?.click?.();
};

const genUploadId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};

const getFileExt = (file) => {
  const name = String(file?.name || "").trim();
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "png";
  const ext = name.slice(idx + 1).trim().toLowerCase();
  return ext || "png";
};

const sanitizeKeyPart = (value) => String(value || "").trim().replace(/[^\w.-]+/g, "_").slice(0, 48);

const buildChatImageKey = (file, index, chatIdOverride) => {
  const userPart = sanitizeKeyPart(authStore.username || "user");
  const chatPart = sanitizeKeyPart(chatIdOverride || activeChatId.value || "chat");
  const ts = Date.now();
  const ext = getFileExt(file);
  return `chat/${userPart}_${chatPart}_${ts}_${index}.${ext}`;
};

const isImageFile = (file) => String(file?.type || "").toLowerCase().startsWith("image/");

const readImageSize = async (file) => {
  if (!file) return null;
  if ("createImageBitmap" in window) {
    const bmp = await createImageBitmap(file);
    const w = bmp.width;
    const h = bmp.height;
    bmp.close?.();
    return { width: w, height: h };
  }

  // 兼容兜底：使用 Image + blobUrl
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      type,
      quality,
    );
  });

// 压缩/缩放图片：限制最大边、导出 webp（可显著减少体积），失败则回退原图
const compressImage = async (file, { maxSide = 1024, quality = 0.82 } = {}) => {
  if (!file || !isImageFile(file)) return file;

  const sizeInfo = await readImageSize(file);
  const width = Number(sizeInfo?.width || 0);
  const height = Number(sizeInfo?.height || 0);
  if (!width || !height) return file;

  const longSide = Math.max(width, height);
  const scale = longSide > maxSide ? maxSide / longSide : 1;
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  // 小图且体积不大：不做处理
  if (scale === 1 && Number(file.size || 0) < 600 * 1024) return file;

  let bitmap;
  try {
    bitmap = "createImageBitmap" in window ? await createImageBitmap(file) : null;
  } catch {
    bitmap = null;
  }

  // 兜底用 Image
  if (!bitmap) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const blob = await canvasToBlob(canvas, "image/webp", quality);
      if (!blob) return file;
      if (blob.size >= Number(file.size || 0)) return file;

      return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: blob.type });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const blob = await canvasToBlob(canvas, "image/webp", quality);
    if (!blob) return file;
    if (blob.size >= Number(file.size || 0)) return file;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: blob.type });
  } finally {
    bitmap.close?.();
  }
};

const removeUploadItem = (id) => {
  const list = uploads.value || [];
  const idx = list.findIndex((u) => String(u?.id) === String(id));
  if (idx < 0) return;
  const [item] = list.splice(idx, 1);
  uploads.value = [...list];
  if (item?.blobUrl) {
    URL.revokeObjectURL(item.blobUrl);
  }
};

const uploadAndSendImages = async (files) => {
  const list = Array.from(files || []).filter(Boolean);
  if (list.length === 0) return;
  const chatIdAtStart = String(activeChatId.value || "");
  if (!chatIdAtStart) return;

  if (isSendLimitedForChat(chatIdAtStart)) {
    antdMessage.warning("等待对方回复后可继续发送");
    return;
  }

  const session = (uploadSession += 1);

  try {
    let i = 0;
    for (const file of list) {
      i += 1;
      if (session !== uploadSession) return;

      const id = genUploadId();
      // 先压缩再上传（避免大图导致气泡观感过大、浪费带宽）
      const prepared = await compressImage(file, { maxSide: 1024, quality: 0.82 });
      const blobUrl = URL.createObjectURL(prepared);
      const item = {
        id,
        name: prepared?.name || file?.name || "图片",
        file: prepared,
        blobUrl,
        chatId: chatIdAtStart,
        progress: 0,
        status: "uploading", // uploading | error | done
        errorMessage: "",
      };
      uploads.value = [...(uploads.value || []), item];
      chatStore.setSendingImages(1);

      try {
        const key = buildChatImageKey(prepared, i, chatIdAtStart);
        const res = await uploadToCos(prepared, key, {
          onProgress: (p) => {
            if (session !== uploadSession) return;
            const percent = Number(p?.percent || 0);
            item.progress = Math.max(0, Math.min(100, Math.round(percent * 100)));
          },
        });
        const url = String(res?.url || "").trim();
        if (!url) throw new Error("图片上传失败");

        item.status = "done";
        item.progress = 100;
        // 上传成功后立即发送图片消息（由服务端回包 new_message 决定最终入列表）
        if (session === uploadSession) {
          await chatStore.sendImageMessage(url, chatIdAtStart);
        }
        removeUploadItem(id);
      } catch (error) {
        item.status = "error";
        item.errorMessage = error?.message || "上传失败";
      } finally {
        chatStore.setSendingImages(-1);
      }
    }
  } finally {
    // 如果中途被打断，确保计数不为负（逐个 finally 已减，这里不再额外处理）
  }
};

const handleFileChange = async (event) => {
  const input = event?.target;
  // 注意：部分浏览器中 input.files 可能是“动态引用”，清空 input.value 会让 files 立即变空。
  // 所以这里必须先复制一份数组，再清空 value。
  const picked = Array.from(input?.files || []).filter(Boolean);
  // 允许用户再次选择同一张图片：清空 value
  if (input) input.value = "";
  if (picked.length === 0) return;
  if (!activeChatId.value) return;

  if (!canPickImage.value) {
    antdMessage.info(isSendLimited.value ? "等待对方回复后可继续发送" : "图片上传中，请稍候");
    return;
  }

  await uploadAndSendImages(picked);
};

const handleRetryUpload = async (item) => {
  if (!item?.file) return;
  const chatId = String(item?.chatId || activeChatId.value || "");
  if (!chatId) return;
  if (isSendLimitedForChat(chatId)) {
    antdMessage.warning("等待对方回复后可继续发送");
    return;
  }

  item.status = "uploading";
  item.errorMessage = "";
  item.progress = 0;

  const session = (uploadSession += 1);
  chatStore.setSendingImages(1);
  try {
    const key = buildChatImageKey(item.file, Date.now(), chatId);
    const res = await uploadToCos(item.file, key, {
      onProgress: (p) => {
        if (session !== uploadSession) return;
        const percent = Number(p?.percent || 0);
        item.progress = Math.max(0, Math.min(100, Math.round(percent * 100)));
      },
    });
    const url = String(res?.url || "").trim();
    if (!url) throw new Error("图片上传失败");
    item.status = "done";
    item.progress = 100;
    await chatStore.sendImageMessage(url, chatId);
    removeUploadItem(item.id);
  } catch (error) {
    item.status = "error";
    item.errorMessage = error?.message || "上传失败";
  } finally {
    chatStore.setSendingImages(-1);
  }
};

const handleSendText = async () => {
  if (!canSendText.value) return;
  const text = String(composerText.value || "");
  composerText.value = "";
  await chatStore.sendTextMessage(text);
};

const handleTextKeydown = async (event) => {
  if (event?.key !== "Enter") return;
  if (event?.shiftKey) return;
  event.preventDefault();
  await handleSendText();
};

const renderLastMessage = (last) => {
  if (!last) return "暂无消息";
  const t = Number(last?.msg_type || 1);
  if (t === 2) return "[图片]";
  const text = String(last?.content || "").trim();
  return text || "暂无消息";
};

const renderMessageTime = (value) => {
  const s = String(value || "").trim();
  if (!s) return "";
  return formatDateTimeMinute(s);
};

const isMine = (msg) => String(msg?.sender?.id || "") === String(authStore.userId || "");

onBeforeUnmount(() => {
  // 释放所有 blobUrl
  for (const u of uploads.value || []) {
    if (u?.blobUrl) URL.revokeObjectURL(u.blobUrl);
  }
  uploads.value = [];
});
</script>

<template>
  <a-drawer
    v-model:open="drawerOpen"
    placement="right"
    :width="980"
    :closable="false"
    class="chat-drawer"
  >
    <div class="chat-shell">
      <div class="chat-top">
        <div class="title">
          <div class="t1">私信</div>
          <div class="t2">
            <span class="ws-dot" :class="wsStatus"></span>
            <span v-if="showWsText" class="ws-text">{{ wsStatusText }}</span>
            <span v-if="totalUnread > 0" class="unread">未读 {{ totalUnread }}</span>
          </div>
        </div>
        <div class="top-actions">
          <a-button
            size="small"
            type="link"
            class="mark-read"
            :disabled="totalUnread <= 0"
            @click="handleMarkAllRead"
          >
            全部已读
          </a-button>
          <button class="top-close" type="button" @click="handleClose">
            <CloseOutlined />
          </button>
        </div>
      </div>

      <div class="chat-body">
        <aside class="left">
          <div class="left-head">会话</div>

          <div ref="listWrapRef" class="left-list">
            <a-spin :spinning="chatListLoading">
              <a-empty v-if="!chatListLoading && (chatList || []).length === 0" description="暂无会话" />

              <div v-else class="items">
                <div
                  v-for="c in chatList"
                  :key="c?.id"
                  class="citem"
                  :class="{ active: String(c?.id) === String(activeChatId), locked: sendingImageCount > 0 }"
                  role="button"
                  tabindex="0"
                  @click="handleSelectChat(c?.id)"
                >
                  <a-badge :count="c?.unread_count || 0" :offset="[6, 2]" :overflowCount="99">
                    <a-avatar :size="42" :src="c?.other_user?.avatar || '/default-avatar.png'" />
                  </a-badge>
                  <div class="cmeta">
                    <div class="crow">
                      <div class="cname">{{ c?.other_user?.username || "用户" }}</div>
                      <div class="ctime">{{ renderMessageTime(c?.last_message?.created || c?.modified) }}</div>
                    </div>
                    <div class="csub">{{ renderLastMessage(c?.last_message) }}</div>
                  </div>
                </div>

                <div v-if="chatListHasMore" class="more">
                  <a-button
                    block
                    :loading="chatListLoadingMore"
                    @click="chatStore.loadMoreChatList"
                  >
                    加载更多
                  </a-button>
                </div>
              </div>
            </a-spin>
          </div>
        </aside>

        <main class="right">
          <div v-if="!activeChatId" class="empty-right">
            <a-empty description="选择一个会话开始聊天" />
          </div>

          <template v-else>
            <div class="right-head">
              <div class="peer">
                <span class="avatar-link" @click="gotoUserProfile(activeOtherUser)">
                  <a-avatar
                    :size="34"
                    :src="activeOtherUser?.avatar || '/default-avatar.png'"
                  />
                </span>
                <div class="peer-meta">
                  <div class="peer-name">
                    <span class="peer-link" @click="gotoUserProfile(activeOtherUser)">{{
                      activeOtherUser?.username || "用户"
                    }}</span>
                    <span
                      v-if="chatMetaMap?.[activeChatId]?.isMutual"
                      class="mutual"
                    >
                      互关
                    </span>
                  </div>
                  <div v-if="isSendLimited" class="peer-sub">
                    <span class="limited">对方回复前仅可发送一条消息</span>
                  </div>
                </div>
              </div>
            </div>

            <div ref="msgWrapRef" class="msg-wrap">
              <a-spin :spinning="Boolean(activeMessagesState?.loading)">
                <a-empty
                  v-if="!activeMessagesState?.loading && (activeMessages || []).length === 0"
                  description="暂无消息"
                />

                <div v-else class="msg-list">
                  <div
                    v-for="m in activeMessages"
                    :key="m?.id"
                    class="msg"
                    :class="{ mine: isMine(m) }"
                  >
                  <span class="avatar-link m-avatar-link" @click="gotoUserProfile(m?.sender)">
                    <a-avatar
                      class="m-avatar"
                      :size="30"
                      :src="m?.sender?.avatar || '/default-avatar.png'"
                    />
                  </span>

                  <div class="mbody">
                      <div class="mmeta">
                        <span class="mname">{{ isMine(m) ? (authStore.username || '我') : (m?.sender?.username || '用户') }}</span>
                        <span class="mtime">{{ renderMessageTime(m?.created) }}</span>
                      </div>

                      <div class="bubble" :class="{ 'img-bubble': Number(m?.msg_type || 1) === 2 }">
                        <template v-if="Number(m?.msg_type || 1) === 2">
                          <a-image
                            :src="m?.content"
                            :preview="true"
                            class="img-msg"
                          />
                        </template>
                        <template v-else>
                          <div class="text-msg">{{ m?.content }}</div>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </a-spin>
            </div>

            <div class="composer">
              <div v-if="(uploads || []).length > 0" class="upload-strip">
                <div v-for="u in uploads" :key="u.id" class="uitem">
                  <div class="thumb">
                    <img :src="u.blobUrl" alt="预览" />
                    <div v-if="u.status === 'uploading'" class="mask">
                      <LoadingOutlined />
                      <div class="p">{{ u.progress }}%</div>
                    </div>
                    <div v-else-if="u.status === 'error'" class="mask error">
                      <div class="e">失败</div>
                    </div>
                  </div>
                  <div class="uactions">
                    <a-button
                      v-if="u.status === 'error'"
                      size="small"
                      type="link"
                      @click="handleRetryUpload(u)"
                    >
                      重试
                    </a-button>
                    <a-button size="small" type="link" danger @click="removeUploadItem(u.id)">
                      移除
                    </a-button>
                  </div>
                </div>
              </div>

              <div class="bar">
                <button
                  class="icon-btn"
                  type="button"
                  :disabled="!canPickImage"
                  @click="handlePickImage"
                >
                  <FileImageOutlined />
                </button>

                <a-textarea
                  v-model:value="composerText"
                  class="input"
                  :autoSize="{ minRows: 1, maxRows: 4 }"
                  placeholder="输入消息，Enter 发送，Shift+Enter 换行"
                  :disabled="!activeChatId || isSendLimited"
                  @keydown="handleTextKeydown"
                />

                <button class="send-btn" type="button" :disabled="!canSendText" @click="handleSendText">
                  <SendOutlined />
                  <span>发送</span>
                </button>
              </div>

              <input
                ref="fileInputRef"
                class="file-input"
                type="file"
                accept="image/*"
                multiple
                aria-label="选择图片"
                @change="handleFileChange"
              />
            </div>
          </template>
        </main>
      </div>
    </div>
  </a-drawer>
</template>

<style scoped>
.chat-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-top {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 6px;
  border-bottom: 1px solid #eef2f7;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mark-read {
  font-weight: 800;
}

.title .t1 {
  font-size: 18px;
  font-weight: 900;
  color: #111827;
  line-height: 1.1;
}

.title .t2 {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 800;
}

.ws-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e2e8f0;
  display: inline-block;
}

.ws-dot.OPEN {
  background: var(--brand-color);
}

.ws-dot.CONNECTING {
  background: #f59e0b;
}

.unread {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(120, 200, 65, 0.12);
  border: 1px solid rgba(120, 200, 65, 0.22);
  color: var(--brand-color);
  font-weight: 900;
}

.top-close {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.top-close:hover {
  background: rgba(148, 163, 184, 0.12);
  color: #111827;
}

.chat-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 360px 1fr;
}

.left {
  border-right: 1px solid #eef2f7;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.left-head {
  height: 46px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  font-weight: 900;
  color: #111827;
}

.left-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 10px 12px;
}

.items {
  display: grid;
  gap: 8px;
}

.citem {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 10px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.citem.locked {
  cursor: not-allowed;
  opacity: 0.72;
}

.citem:hover {
  background: rgba(120, 200, 65, 0.06);
}

.citem.active {
  background: rgba(120, 200, 65, 0.12);
}

.cmeta {
  min-width: 0;
  flex: 1;
}

.crow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cname {
  font-weight: 900;
  color: #111827;
  font-size: 14px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ctime {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 800;
  flex: none;
}

.csub {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
  font-weight: 700;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more {
  margin-top: 6px;
}

.right {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.empty-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.right-head {
  height: 62px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #eef2f7;
}

.peer {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.peer-meta {
  min-width: 0;
}

.peer-name {
  font-weight: 900;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mutual {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(120, 200, 65, 0.12);
  border: 1px solid rgba(120, 200, 65, 0.22);
  color: var(--brand-color);
  font-size: 12px;
  font-weight: 900;
  line-height: 1.2;
}

.peer-sub {
  margin-top: 2px;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 700;
}

.avatar-link {
  cursor: pointer;
  display: inline-flex;
}

.m-avatar-link {
  flex: none;
}

.peer-link {
  cursor: pointer;
}

.peer-link:hover {
  color: var(--brand-color-dark);
}

.limited {
  color: #ef4444;
}

.msg-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px 18px;
  background: #fbfcfe;
}

.msg-list {
  display: grid;
  gap: 12px;
}

.msg {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.msg.mine {
  flex-direction: row-reverse;
}

.mbody {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 78%;
  min-width: 0;
}

.msg.mine .mbody {
  align-items: flex-end;
}

.mmeta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 700;
}

.msg.mine .mmeta {
  justify-content: flex-end;
}

.bubble {
  display: inline-block;
  max-width: 100%;
  border-radius: 12px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #eef2f7;
  color: #111827;
  font-weight: 700;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.bubble.img-bubble {
  padding: 6px;
  background: transparent;
  border-color: transparent;
}

.msg.mine .bubble {
  background: rgba(120, 200, 65, 0.14);
  border-color: rgba(120, 200, 65, 0.25);
}

.msg.mine .bubble.img-bubble {
  background: transparent;
  border-color: transparent;
}

.img-msg :deep(img) {
  border-radius: 10px;
  max-width: 200px;
  max-height: 200px;
  object-fit: cover;
}

.composer {
  border-top: 1px solid #eef2f7;
  padding: 10px 12px;
  background: #fff;
}

.upload-strip {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.uitem {
  flex: none;
  width: 110px;
}

.thumb {
  width: 110px;
  height: 86px;
  border-radius: 12px;
  overflow: hidden;
  background: #f1f5f9;
  position: relative;
  border: 1px solid #eef2f7;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(15, 23, 42, 0.45);
  color: #fff;
  font-weight: 900;
  font-size: 12px;
}

.mask.error {
  background: rgba(239, 68, 68, 0.55);
}

.uactions {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  margin-top: 6px;
}

.bar {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid #eef2f7;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  border-color: rgba(120, 200, 65, 0.45);
  color: var(--brand-color);
}

.icon-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.input :deep(textarea.ant-input) {
  border-radius: 12px;
  background: #f6f7f9;
  border-color: transparent;
  font-weight: 700;
}

.send-btn {
  height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--brand-color);
  background: var(--brand-color);
  color: #fff;
  font-weight: 900;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.send-btn:hover {
  border-color: var(--brand-color-dark);
  background: var(--brand-color-dark);
}

.send-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.file-input {
  position: fixed;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
}
</style>
