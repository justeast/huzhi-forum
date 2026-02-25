<script setup>
import { computed, watch, ref } from "vue";
import { message } from "ant-design-vue";
import {
  createCollectionFolder,
  fetchAllCollections,
  fetchAllCollectionsContainingAnswer,
  toggleCollectAnswer,
} from "../api/collection";

const props = defineProps({
  open: { type: Boolean, default: false },
  answerId: { type: String, default: "" },
  answerLabel: { type: String, default: "" },
});

const emit = defineEmits(["update:open", "applied"]);

const modalOpen = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v),
});

const collectionsLoading = ref(false);
const collectModalLoading = ref(false);
const collectConfirmLoading = ref(false);

const collections = ref([]);
const initialIds = ref([]);
const draftIds = ref([]);

const createCollectionOpen = ref(false);
const createCollectionLoading = ref(false);
const createCollectionForm = ref({
  title: "",
  description: "",
  is_public: true,
});

const ensureCollectionsLoaded = async () => {
  if (collectionsLoading.value) return;
  if ((collections.value || []).length > 0) return;

  collectionsLoading.value = true;
  try {
    const data = await fetchAllCollections({ size: 20 });
    collections.value = data?.results || [];
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "获取收藏夹列表失败");
  } finally {
    collectionsLoading.value = false;
  }
};

const loadContainingCollections = async (answerId) => {
  if (!answerId) return;

  collectModalLoading.value = true;
  try {
    const data = await fetchAllCollectionsContainingAnswer(answerId, { size: 20 });
    const ids = (data?.results || [])
      .map((x) => x?.id)
      .filter((x) => Boolean(x));
    initialIds.value = ids;
    draftIds.value = [...ids];
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "获取收藏状态失败");
  } finally {
    collectModalLoading.value = false;
  }
};

const isDraftInCollection = (collectionId) =>
  (draftIds.value || []).includes(collectionId);

const toggleDraftCollection = (collectionId) => {
  if (!collectionId) return;
  const set = new Set(draftIds.value || []);
  if (set.has(collectionId)) set.delete(collectionId);
  else set.add(collectionId);
  draftIds.value = Array.from(set);
};

const openCreateCollection = () => {
  createCollectionForm.value = {
    title: "",
    description: "",
    is_public: true,
  };
  createCollectionOpen.value = true;
};

const handleCreateCollection = async () => {
  if (createCollectionLoading.value) return;

  const title = String(createCollectionForm.value.title || "").trim();
  if (!title) {
    message.warning("请输入收藏夹标题");
    return;
  }

  createCollectionLoading.value = true;
  try {
    const created = await createCollectionFolder({
      title,
      description: String(createCollectionForm.value.description || "").trim(),
      is_public: Boolean(createCollectionForm.value.is_public),
    });

    collections.value = [created, ...(collections.value || [])];
    createCollectionOpen.value = false;
    message.success("收藏夹已创建");

    // 新建后先在草稿态自动勾选，最终提交以“完成”为准
    const id = created?.id;
    if (id) {
      const set = new Set(draftIds.value || []);
      set.add(id);
      draftIds.value = Array.from(set);
    }
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "创建收藏夹失败");
  } finally {
    createCollectionLoading.value = false;
  }
};

const handleCancel = () => {
  // 取消：不提交接口，恢复初始勾选态
  draftIds.value = [...(initialIds.value || [])];
  modalOpen.value = false;
};

const resyncState = async () => {
  await ensureCollectionsLoaded();
  await loadContainingCollections(props.answerId);
};

const handleOk = async () => {
  const answerId = props.answerId;
  if (!answerId) {
    modalOpen.value = false;
    return;
  }
  if (collectConfirmLoading.value) return;

  const beforeSize = (initialIds.value || []).length;
  const initialSet = new Set(initialIds.value || []);
  const draftSet = new Set(draftIds.value || []);

  const changed = new Set();
  for (const id of initialSet) changed.add(id);
  for (const id of draftSet) changed.add(id);
  const diffIds = Array.from(changed).filter(
    (id) => initialSet.has(id) !== draftSet.has(id),
  );

  if (diffIds.length === 0) {
    modalOpen.value = false;
    return;
  }

  const orderedIds = (collections.value || [])
    .map((c) => c?.id)
    .filter((id) => diffIds.includes(id))
    .concat(diffIds.filter((id) => !(collections.value || []).some((c) => c?.id === id)));

  collectConfirmLoading.value = true;
  try {
    for (const collectionId of orderedIds) {
      const res = await toggleCollectAnswer(collectionId, answerId);
      if (res?.answer_count !== undefined) {
        const hit = (collections.value || []).find((c) => c?.id === collectionId);
        if (hit) hit.answer_count = Math.max(0, Number(res.answer_count || 0));
      }
    }

    const finalIds = Array.from(draftSet);
    initialIds.value = finalIds;
    draftIds.value = [...finalIds];

    emit("applied", {
      answerId,
      beforeSize,
      afterSize: finalIds.length,
      collectionIds: finalIds,
    });

    modalOpen.value = false;
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "操作失败，已为你刷新最新收藏状态");
    try {
      await resyncState();
    } catch {
      // 忽略二次刷新失败
    }
  } finally {
    collectConfirmLoading.value = false;
  }
};

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    if (!props.answerId) return;
    await ensureCollectionsLoaded();
    await loadContainingCollections(props.answerId);
  },
);
</script>

<template>
  <a-modal
    v-model:open="modalOpen"
    title="收藏到收藏夹"
    ok-text="完成"
    cancel-text="取消"
    :confirm-loading="collectConfirmLoading"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <div class="collect-modal">
      <div class="collect-head">
        <div class="collect-tip">
          <div class="collect-title">可多选收藏夹</div>
          <div class="collect-sub">
            <template v-if="answerLabel">正在收藏：{{ answerLabel }}</template>
            <template v-else>请选择收藏夹</template>
          </div>
        </div>
        <a-button type="primary" @click="openCreateCollection">
          新建收藏夹
        </a-button>
      </div>

      <a-spin :spinning="collectionsLoading || collectModalLoading">
        <a-empty v-if="collections.length === 0" description="暂无收藏夹" />

        <a-list v-else :data-source="collections" class="collect-list">
          <template #renderItem="{ item }">
            <a-list-item class="collect-item">
              <div class="collect-card">
                <a-checkbox
                  :checked="isDraftInCollection(item?.id)"
                  :disabled="collectConfirmLoading || !answerId"
                  @change="() => toggleDraftCollection(item?.id)"
                />

                <div class="collect-info">
                  <div class="collect-name">
                    {{ item?.title || "未命名收藏夹" }}
                    <span class="collect-private">
                      {{ item?.is_public ? "公开" : "私密" }}
                    </span>
                  </div>
                  <div class="collect-desc">
                    {{ item?.description || "暂无简介" }}
                  </div>
                </div>

                <div class="collect-meta">
                  <div class="collect-count">
                    {{ Number(item?.answer_count || 0) }} 条
                  </div>
                  <div v-if="collectConfirmLoading" class="collect-loading">
                    保存中
                  </div>
                </div>
              </div>
            </a-list-item>
          </template>
        </a-list>
      </a-spin>
    </div>

    <a-modal
      v-model:open="createCollectionOpen"
      title="新建收藏夹"
      :confirm-loading="createCollectionLoading"
      ok-text="创建"
      cancel-text="取消"
      @ok="handleCreateCollection"
    >
      <a-form layout="vertical">
        <a-form-item label="收藏夹标题" required>
          <a-input
            v-model:value="createCollectionForm.title"
            placeholder="请输入收藏夹标题"
            :maxlength="40"
            show-count
          />
        </a-form-item>

        <a-form-item label="收藏夹简介">
          <a-textarea
            v-model:value="createCollectionForm.description"
            placeholder="简单介绍一下这个收藏夹（可选）"
            :rows="3"
            :maxlength="120"
            show-count
          />
        </a-form-item>

        <a-form-item label="是否公开">
          <a-switch v-model:checked="createCollectionForm.is_public" />
          <span class="public-hint">
            {{ createCollectionForm.is_public ? "公开" : "私密" }}
          </span>
        </a-form-item>
      </a-form>
    </a-modal>
  </a-modal>
</template>

<style scoped>
.collect-modal {
  padding: 2px 0 0;
}

.collect-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.collect-title {
  font-weight: 900;
  color: #111827;
  line-height: 1.2;
}

.collect-sub {
  margin-top: 6px;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.collect-list {
  margin-top: 10px;
}

.collect-item {
  padding: 0;
  border: none;
}

.collect-card {
  width: 100%;
  display: grid;
  grid-template-columns: 26px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px 12px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  background: #fff;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.collect-card:hover {
  border-color: rgba(120, 200, 65, 0.35);
  background: rgba(120, 200, 65, 0.04);
}

.collect-info {
  min-width: 0;
}

.collect-name {
  font-weight: 900;
  color: #111827;
  line-height: 1.2;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.collect-private {
  font-size: 12px;
  font-weight: 900;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 2px 8px;
  border-radius: 999px;
  flex: none;
}

.collect-desc {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.collect-meta {
  display: grid;
  justify-items: end;
  gap: 6px;
  flex: none;
  white-space: nowrap;
}

.collect-count {
  font-size: 12px;
  font-weight: 900;
  color: #64748b;
}

.collect-loading {
  font-size: 12px;
  font-weight: 800;
  color: var(--brand-color);
}

.public-hint {
  margin-left: 10px;
  color: #64748b;
  font-weight: 800;
  font-size: 12px;
}
</style>

