<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { LikeFilled, LikeOutlined } from "@ant-design/icons-vue";
import {
  createComment,
  deleteComment,
  fetchCommentPage,
  fetchCommentsByAnswer,
  fetchCommentsByParent,
  toggleLikeComment,
} from "../api/comment";
import { useAuthStore } from "../stores/auth";
import { formatDateTimeMinute } from "../utils/format";

const props = defineProps({
  answerId: { type: [String, Number], required: true },
  answerAuthorId: { type: [String, Number], default: "" },
  commentCount: { type: [Number, String], default: 0 },
  pageSize: { type: Number, default: 20 },
});

const emit = defineEmits(["count-change", "collapse"]);

const authStore = useAuthStore();
const currentUserId = computed(() => String(authStore.userId || ""));

const count = ref(Math.max(0, Number(props.commentCount || 0)));
watch(
  () => props.commentCount,
  (val) => {
    count.value = Math.max(0, Number(val || 0));
  },
);

const getAvatar = (user) => user?.avatar || "/default-avatar.png";

const rootLoading = ref(false);
const rootLoadingMore = ref(false);
const rootNext = ref(null);
const rootComments = ref([]);

const replyStateByParentId = ref({});
const likeLoadingMap = ref({});
const deleteLoadingMap = ref({});

const inputRef = ref(null);
const draft = ref("");
const submitting = ref(false);
const replying = ref(null);

const replyTip = computed(() => {
  if (!replying.value) return "";
  const name = replying.value?.replyToUsername || "";
  return name ? `回复 @${name}` : "回复";
});

const canDelete = (comment) => {
  const me = currentUserId.value;
  if (!me) return false;
  const commentUserId = String(comment?.user?.id || "");
  const answerAuthorId = String(props.answerAuthorId || "");
  return Boolean(me && (me === commentUserId || (answerAuthorId && me === answerAuthorId)));
};

const setMapFlag = (mapRef, key, val) => {
  if (!key) return;
  mapRef.value = mapRef.value || {};
  mapRef.value = { ...mapRef.value, [key]: val };
};

const clearMapFlag = (mapRef, key) => {
  if (!key) return;
  if (!mapRef.value?.[key]) return;
  const next = { ...(mapRef.value || {}) };
  delete next[key];
  mapRef.value = next;
};

const normalizeRootList = (results = []) =>
  (results || []).filter((x) => x && !x.parent);

const hasReplies = (parentId) => {
  const id = String(parentId || "");
  if (!id) return false;
  const state = replyStateByParentId.value?.[id];
  if (!state?.checked) return false;
  return Number(state?.count || 0) > 0;
};

const probeReplyCountsForRoots = async (roots = []) => {
  const ids = (roots || [])
    .map((x) => x?.id)
    .filter((x) => Boolean(x))
    .map((x) => String(x));

  const uniq = Array.from(new Set(ids));
  const queue = uniq.filter((id) => {
    const state = ensureReplyState(id);
    if (!state) return false;
    if (state.checked || state.checking) return false;
    return true;
  });

  if (queue.length === 0) return;

  const concurrency = 4;
  const worker = async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) continue;

      const state = ensureReplyState(id);
      if (!state) continue;
      if (state.checked || state.checking) continue;

      state.checking = true;
      replyStateByParentId.value = { ...(replyStateByParentId.value || {}) };

      try {
        const data = await fetchCommentsByParent(id, { page: 1, size: 1 });
        state.count = Number(data?.count || 0);
        state.checked = true;
      } catch (error) {
        if (error?.__handled401) return;
        // 失败时不打扰用户，保持未检查状态，避免误隐藏
      } finally {
        state.checking = false;
        replyStateByParentId.value = { ...(replyStateByParentId.value || {}) };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()),
  );
};

const loadRootComments = async ({ reset } = {}) => {
  if (!props.answerId) return;
  if (rootLoading.value) return;

  if (reset) {
    rootNext.value = null;
    rootComments.value = [];
    replyStateByParentId.value = {};
  }

  rootLoading.value = true;
  try {
    const data = await fetchCommentsByAnswer(props.answerId, {
      page: 1,
      size: props.pageSize,
    });
    rootNext.value = data?.next || null;
    rootComments.value = normalizeRootList(data?.results || []);
    await probeReplyCountsForRoots(rootComments.value);
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "获取评论失败");
  } finally {
    rootLoading.value = false;
  }
};

const loadMoreRootComments = async () => {
  if (!rootNext.value) return;
  if (rootLoadingMore.value) return;

  rootLoadingMore.value = true;
  try {
    const data = await fetchCommentPage(rootNext.value);
    rootNext.value = data?.next || null;

    const more = normalizeRootList(data?.results || []);
    if (more.length > 0) {
      rootComments.value = [...rootComments.value, ...more];
      await probeReplyCountsForRoots(more);
    }
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "加载更多评论失败");
  } finally {
    rootLoadingMore.value = false;
  }
};

const ensureReplyState = (parentId) => {
  if (!parentId) return null;
  const id = String(parentId);
  const map = replyStateByParentId.value || {};
  if (map[id]) return map[id];

  const next = {
    open: false,
    loading: false,
    loadingMore: false,
    checking: false,
    checked: false,
    next: null,
    count: 0,
    items: [],
  };
  replyStateByParentId.value = { ...map, [id]: next };
  return next;
};

const loadReplies = async (parentId, { reset } = {}) => {
  if (!parentId) return;
  const state = ensureReplyState(parentId);
  if (!state) return;
  if (state.loading) return;

  state.loading = true;
  if (reset) {
    state.items = [];
    state.next = null;
  }

  try {
    const data = await fetchCommentsByParent(parentId, {
      page: 1,
      size: props.pageSize,
    });
    state.next = data?.next || null;
    state.count = Number(data?.count || 0);
    state.items = data?.results || [];
    state.checked = true;
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "获取回复失败");
  } finally {
    state.loading = false;
    replyStateByParentId.value = { ...(replyStateByParentId.value || {}) };
  }
};

const loadMoreReplies = async (parentId) => {
  if (!parentId) return;
  const state = ensureReplyState(parentId);
  if (!state?.next) return;
  if (state.loadingMore) return;

  state.loadingMore = true;
  try {
    const data = await fetchCommentPage(state.next);
    state.next = data?.next || null;
    state.count = Number(data?.count || state.count || 0);
    const more = data?.results || [];
    if (more.length > 0) state.items = [...(state.items || []), ...more];
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "加载更多回复失败");
  } finally {
    state.loadingMore = false;
    replyStateByParentId.value = { ...(replyStateByParentId.value || {}) };
  }
};

const toggleReplyOpen = async (parentComment) => {
  const parentId = parentComment?.id;
  if (!parentId) return;
  const state = ensureReplyState(parentId);
  if (!state) return;

  if (state.open) {
    state.open = false;
    replyStateByParentId.value = { ...(replyStateByParentId.value || {}) };
    return;
  }

  // 没有二级评论时不展示“展开回复”，这里兜底避免误点
  if (state.checked && Number(state.count || 0) === 0) return;

  state.open = !state.open;
  replyStateByParentId.value = { ...(replyStateByParentId.value || {}) };

  if (state.open && (state.items || []).length === 0) {
    await loadReplies(parentId, { reset: true });
  }
};

const beginReply = async (parentComment, targetUser) => {
  if (!parentComment?.id) return;
  const userId = targetUser?.id;
  if (!userId) return;

  replying.value = {
    parentId: parentComment.id,
    replyToId: userId,
    replyToUsername: targetUser?.username || "",
  };

  await nextTick();
  if (inputRef.value?.focus) inputRef.value.focus();
};

const cancelReply = () => {
  replying.value = null;
};

const bumpCount = (nextCount) => {
  const v = Math.max(0, Number(nextCount || 0));
  count.value = v;
  emit("count-change", v);
};

const handleSubmit = async () => {
  if (submitting.value) return;
  const text = String(draft.value || "").trim();
  if (!text) {
    message.warning("请输入评论内容");
    return;
  }

  submitting.value = true;
  try {
    const payload = {
      answerId: props.answerId,
      content: text,
    };

    if (replying.value?.parentId && replying.value?.replyToId) {
      payload.parentId = replying.value.parentId;
      payload.replyToId = replying.value.replyToId;
    }

    const created = await createComment(payload);
    const isReply = Boolean(created?.parent);

    if (!isReply) {
      rootComments.value = [created, ...(rootComments.value || [])];
    } else {
      const parentId = String(created?.parent || replying.value?.parentId || "");
      const state = ensureReplyState(parentId);
      if (state) {
        state.open = true;
        state.items = [...(state.items || []), created];
        state.count = Math.max(0, Number(state.count || 0) + 1);
        state.checked = true;
        replyStateByParentId.value = { ...(replyStateByParentId.value || {}) };
      }
    }

    bumpCount(count.value + 1);
    draft.value = "";
    replying.value = null;
    message.success("评论成功");
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "评论失败");
  } finally {
    submitting.value = false;
  }
};

const findAndUpdateComment = (commentId, patch) => {
  const id = String(commentId || "");
  if (!id || !patch) return;

  const roots = rootComments.value || [];
  const idx = roots.findIndex((x) => String(x?.id || "") === id);
  if (idx >= 0) {
    const next = [...roots];
    next[idx] = { ...next[idx], ...patch };
    rootComments.value = next;
    return;
  }

  const replyMap = replyStateByParentId.value || {};
  for (const key of Object.keys(replyMap)) {
    const state = replyMap[key];
    const items = state?.items || [];
    const j = items.findIndex((x) => String(x?.id || "") === id);
    if (j >= 0) {
      state.items = [...items.slice(0, j), { ...items[j], ...patch }, ...items.slice(j + 1)];
      replyStateByParentId.value = { ...(replyStateByParentId.value || {}) };
      return;
    }
  }
};

const handleToggleLike = async (comment) => {
  const id = comment?.id;
  if (!id) return;
  if (likeLoadingMap.value?.[id]) return;

  setMapFlag(likeLoadingMap, id, true);
  try {
    const patch = await toggleLikeComment(id);
    findAndUpdateComment(id, patch);
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "操作失败");
  } finally {
    clearMapFlag(likeLoadingMap, id);
  }
};

const removeCommentFromState = (commentId) => {
  const id = String(commentId || "");
  if (!id) return;

  const roots = rootComments.value || [];
  const idx = roots.findIndex((x) => String(x?.id || "") === id);
  if (idx >= 0) {
    rootComments.value = [...roots.slice(0, idx), ...roots.slice(idx + 1)];
    const map = { ...(replyStateByParentId.value || {}) };
    delete map[id];
    replyStateByParentId.value = map;
    return;
  }

  const replyMap = replyStateByParentId.value || {};
  for (const key of Object.keys(replyMap)) {
    const state = replyMap[key];
    const items = state?.items || [];
    const j = items.findIndex((x) => String(x?.id || "") === id);
    if (j >= 0) {
      state.items = [...items.slice(0, j), ...items.slice(j + 1)];
      state.count = Math.max(0, Number(state.count || 0) - 1);
      if (state.count === 0) {
        state.open = false;
        state.next = null;
      }
      replyStateByParentId.value = { ...(replyStateByParentId.value || {}) };
      return;
    }
  }
};

const handleTextareaKeydown = (event) => {
  if (!event) return;
  if (event.key !== "Enter") return;
  if (event.isComposing) return;
  if (event.shiftKey) return; // Shift+Enter 换行
  if (event.ctrlKey || event.altKey || event.metaKey) return;

  event.preventDefault();
  handleSubmit();
};

const handleDelete = async (comment) => {
  const id = comment?.id;
  if (!id) return;
  if (deleteLoadingMap.value?.[id]) return;

  setMapFlag(deleteLoadingMap, id, true);
  try {
    const data = await deleteComment(id);
    removeCommentFromState(id);
    if (data?.comment_count !== undefined) {
      bumpCount(data.comment_count);
    }
    message.success("已删除");
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "删除失败");
  } finally {
    clearMapFlag(deleteLoadingMap, id);
  }
};

onMounted(async () => {
  await loadRootComments({ reset: true });
  await nextTick();
  if (inputRef.value?.focus) inputRef.value.focus();
});
</script>

<template>
  <div class="comment-section" @click.stop>
    <div class="head">
      <div class="title">
        <span class="num">{{ Number(count || 0) }}</span>
        <span class="unit">条评论</span>
      </div>

      <button class="collapse-btn" type="button" @click="emit('collapse')">
        收起
      </button>
    </div>

    <div class="composer">
      <div v-if="replying" class="replying">
        <span class="replying-text">{{ replyTip }}</span>
        <button class="replying-cancel" type="button" @click="cancelReply">
          取消回复
        </button>
      </div>

      <a-textarea
        ref="inputRef"
        v-model:value="draft"
        :auto-size="{ minRows: 2, maxRows: 4 }"
        :maxlength="500"
        :disabled="submitting"
        placeholder="理性发言，友善互动"
        allow-clear
        @keydown="handleTextareaKeydown"
      />

      <div class="composer-actions">
        <div class="hint">最多 500 字</div>
        <a-button type="primary" :loading="submitting" @click="handleSubmit">
          发表评论
        </a-button>
      </div>
    </div>

    <div class="list">
      <a-spin :spinning="rootLoading">
        <a-empty v-if="rootComments.length === 0" description="暂无评论" />

        <a-list v-else :data-source="rootComments" class="root-list">
          <template #renderItem="{ item }">
            <a-list-item class="root-item">
              <div class="root">
                <a-avatar :size="34" :src="getAvatar(item?.user)" />

                <div class="body">
                  <div class="meta">
                    <div class="name">{{ item?.user?.username || "匿名用户" }}</div>
                  </div>

                  <div class="content">
                    {{ item?.content }}
                  </div>

                  <div class="footer">
                    <div class="footer-top">
                      <div class="time">{{ formatDateTimeMinute(item?.created) }}</div>

                      <div class="right-actions">
                        <button
                          class="action reply"
                          type="button"
                          @click="beginReply(item, item?.user)"
                        >
                          回复
                        </button>

                        <button
                          class="action like"
                          type="button"
                          :disabled="likeLoadingMap?.[item?.id]"
                          @click="handleToggleLike(item)"
                        >
                          <template v-if="item?.user_has_liked">
                            <LikeFilled />
                          </template>
                          <template v-else>
                            <LikeOutlined />
                          </template>
                          <span class="count">{{ Number(item?.like_count || 0) }}</span>
                        </button>

                        <a-popconfirm
                          v-if="canDelete(item)"
                          title="确定要删除这条评论吗？"
                          ok-text="删除"
                          cancel-text="取消"
                          :ok-button-props="{
                            danger: true,
                            loading: deleteLoadingMap?.[item?.id],
                          }"
                          @confirm="handleDelete(item)"
                        >
                          <button class="action danger" type="button">删除</button>
                        </a-popconfirm>
                      </div>
                    </div>

                    <div v-if="hasReplies(item?.id)" class="footer-bottom">
                      <button
                        class="action toggle-reply"
                        type="button"
                        @click="toggleReplyOpen(item)"
                      >
                        <template v-if="replyStateByParentId?.[item?.id]?.open">
                          收起回复
                        </template>
                        <template v-else>
                          展开 {{ Number(replyStateByParentId?.[item?.id]?.count || 0) }} 条回复
                        </template>
                      </button>
                    </div>
                  </div>

                  <div
                    v-if="replyStateByParentId?.[item?.id]?.open"
                    class="replies"
                  >
                    <a-spin :spinning="replyStateByParentId?.[item?.id]?.loading">
                      <a-empty
                        v-if="(replyStateByParentId?.[item?.id]?.items || []).length === 0"
                        description="暂无回复"
                      />

                      <div v-else class="reply-list">
                        <div
                          v-for="r in replyStateByParentId?.[item?.id]?.items"
                          :key="r.id"
                          class="reply-item"
                        >
                          <a-avatar :size="28" :src="getAvatar(r?.user)" />

                          <div class="reply-body">
                            <div class="reply-line">
                              <span class="name">{{ r?.user?.username || "匿名用户" }}</span>
                              <template v-if="r?.reply_to?.username">
                                <span class="sep">回复</span>
                                <span class="name">{{ r?.reply_to?.username }}</span>
                              </template>
                              <span class="sep">：</span>
                              <span class="text">{{ r?.content }}</span>
                            </div>

                            <div class="reply-meta">
                              <div class="time">{{ formatDateTimeMinute(r?.created) }}</div>

                              <div class="reply-actions">
                                <button
                                  class="action reply"
                                  type="button"
                                  @click="beginReply(item, r?.user)"
                                >
                                  回复
                                </button>

                                <button
                                  class="action like"
                                  type="button"
                                  :disabled="likeLoadingMap?.[r?.id]"
                                  @click="handleToggleLike(r)"
                                >
                                  <template v-if="r?.user_has_liked">
                                    <LikeFilled />
                                  </template>
                                  <template v-else>
                                    <LikeOutlined />
                                  </template>
                                  <span class="count">{{ Number(r?.like_count || 0) }}</span>
                                </button>

                                <a-popconfirm
                                  v-if="canDelete(r)"
                                  title="确定要删除这条回复吗？"
                                  ok-text="删除"
                                  cancel-text="取消"
                                  :ok-button-props="{
                                    danger: true,
                                    loading: deleteLoadingMap?.[r?.id],
                                  }"
                                  @confirm="handleDelete(r)"
                                >
                                  <button class="action danger" type="button">删除</button>
                                </a-popconfirm>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div v-if="replyStateByParentId?.[item?.id]?.next" class="more">
                          <a-button
                            type="link"
                            :loading="replyStateByParentId?.[item?.id]?.loadingMore"
                            @click="loadMoreReplies(item?.id)"
                          >
                            加载更多回复
                          </a-button>
                        </div>
                      </div>
                    </a-spin>
                  </div>
                </div>
              </div>
            </a-list-item>
          </template>
        </a-list>

        <div v-if="rootNext" class="more">
          <a-button type="link" :loading="rootLoadingMore" @click="loadMoreRootComments">
            加载更多评论
          </a-button>
        </div>
      </a-spin>
    </div>
  </div>
</template>

<style scoped>
.comment-section {
  margin-top: 12px;
  padding: 14px 14px 10px;
  border-top: 1px solid #f0f2f5;
  background: #fbfcff;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-weight: 900;
  color: #111827;
}

.num {
  font-size: 16px;
}

.unit {
  color: #64748b;
  font-weight: 700;
  font-size: 13px;
}

.collapse-btn {
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 6px;
}

.collapse-btn:hover {
  color: var(--brand-color);
}

.composer {
  border: 1px solid #eef2f7;
  background: #fff;
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 12px;
}

.replying {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.replying-text {
  color: #334155;
  font-weight: 700;
  font-size: 13px;
}

.replying-cancel {
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.replying-cancel:hover {
  color: #ef4444;
}

.composer-actions {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hint {
  color: #94a3b8;
  font-size: 12px;
}

.root {
  width: 100%;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.body {
  flex: 1;
  min-width: 0;
}

.meta {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
}

.name {
  font-weight: 900;
  color: #111827;
  font-size: 13px;
}

.time {
  color: #94a3b8;
  font-size: 12px;
}

.content {
  margin-top: 6px;
  color: #334155;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.footer {
  margin-top: 10px;
}

.footer-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.right-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.footer-bottom {
  margin-top: 10px;
}

.action {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: #64748b;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.action:hover {
  color: var(--brand-color);
}

.action:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.action.danger:hover {
  color: #ef4444;
}

.count {
  font-weight: 700;
  color: inherit;
}

.action.toggle-reply {
  background: #f1f5f9;
  padding: 6px 10px;
  border-radius: 8px;
  font-weight: 800;
}

.action.toggle-reply:hover {
  background: #e8eef7;
}

.replies {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #eef2f7;
  background: #fff;
  border-radius: 10px;
}

.reply-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reply-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.reply-body {
  flex: 1;
  min-width: 0;
}

.reply-line {
  color: #334155;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.sep {
  color: #94a3b8;
  margin: 0 4px;
}

.text {
  white-space: pre-wrap;
}

.reply-meta {
  margin-top: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.reply-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.more {
  margin-top: 8px;
}
</style>
