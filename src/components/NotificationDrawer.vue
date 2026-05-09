<script setup>
import { computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { message } from "ant-design-vue";
import {
  BellOutlined,
  CheckOutlined,
  CommentOutlined,
  LikeOutlined,
  MessageOutlined,
  UserAddOutlined,
} from "@ant-design/icons-vue";
import { useRouter } from "vue-router";
import { useNotificationStore } from "../stores/notification";
import { NOTIFICATION_TYPE } from "../constants/notification";
import { formatDateTimeMinute } from "../utils/format";

const router = useRouter();
const notificationStore = useNotificationStore();

const {
  drawerOpen,
  notificationList,
  loading,
  loadingMore,
  hasMore,
  unreadCount,
  markLoadingMap,
  markingAll,
} = storeToRefs(notificationStore);

const notificationUnread = computed(() => Math.max(0, Number(unreadCount.value || 0)));

const getAvatar = (item) => item?.actor?.avatar || "/default-avatar.png";

const getTypeIcon = (type) => {
  const value = Number(type || 0);
  if (value === NOTIFICATION_TYPE.QUESTION_ANSWERED) return MessageOutlined;
  if (value === NOTIFICATION_TYPE.ANSWER_UPVOTED) return LikeOutlined;
  if (value === NOTIFICATION_TYPE.COMMENT_REPLIED) return CommentOutlined;
  if (value === NOTIFICATION_TYPE.USER_FOLLOWED) return UserAddOutlined;
  return BellOutlined;
};

const buildTargetRoute = (item) => {
  const type = Number(item?.type || 0);
  const payload = item?.payload || {};

  if (type === NOTIFICATION_TYPE.USER_FOLLOWED) {
    const userId = String(payload?.user_id || "").trim();
    if (!userId) return null;
    return { path: `/user/${userId}` };
  }

  const questionId = String(payload?.question_id || "").trim();
  if (!questionId) return null;

  const query = {};
  const answerId = String(payload?.answer_id || "").trim();
  const commentId = String(payload?.comment_id || "").trim();
  const parentId = String(payload?.parent_comment_id || "").trim();

  if (answerId) query.answer = answerId;
  if (commentId) query.comment = commentId;
  if (parentId) query.parent = parentId;

  return {
    path: `/question/${questionId}`,
    query,
  };
};

const handleClose = () => {
  notificationStore.closeDrawer();
};

const handleMarkAllRead = async () => {
  const unread = Math.max(0, Number(unreadCount.value || 0));
  if (unread <= 0) {
    message.info("暂无未读通知");
    return;
  }

  try {
    await notificationStore.markAllRead();
    message.success("已全部标为已读");
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "操作失败");
  }
};

const handleLoadMore = async () => {
  try {
    await notificationStore.loadMoreNotificationList();
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "加载更多通知失败");
  }
};

const handleClickItem = async (item) => {
  if (!item?.id) return;

  try {
    if (!item?.is_read) {
      await notificationStore.markOneRead(item.id);
    }
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "标记已读失败");
    return;
  }

  const target = buildTargetRoute(item);
  if (!target) {
    message.info("该通知暂不支持跳转");
    return;
  }

  notificationStore.closeDrawer();
  router.push(target);
};

watch(
  () => drawerOpen.value,
  async (open) => {
    if (!open) return;
    try {
      await notificationStore.loadNotificationList();
    } catch (error) {
      if (error?.__handled401) return;
      message.error(error?.message || "获取通知列表失败");
    }
  },
);
</script>

<template>
  <a-drawer
    :open="drawerOpen"
    :width="420"
    placement="right"
    @close="handleClose"
  >
    <template #title>
      <div class="drawer-title">
        <span>通知</span>
        <span v-if="notificationUnread > 0" class="title-unread">未读 {{ notificationUnread }}</span>
      </div>
    </template>

    <template #extra>
      <a-button
        type="link"
        class="read-all-btn"
        :disabled="unreadCount <= 0"
        :loading="markingAll"
        @click="handleMarkAllRead"
      >
        全部已读
      </a-button>
    </template>

    <div class="notification-drawer">
      <a-spin :spinning="loading && notificationList.length === 0">
        <a-empty v-if="!loading && notificationList.length === 0" description="暂无通知" />

        <div v-else class="notification-list">
          <button
            v-for="item in notificationList"
            :key="item.id"
            class="notification-item"
            :class="{ unread: !item?.is_read }"
            type="button"
            @click="handleClickItem(item)"
          >
            <div class="left-icon">
              <a-avatar :src="getAvatar(item)" :size="40" />
              <span class="type-icon">
                <component :is="getTypeIcon(item?.type)" />
              </span>
            </div>

            <div class="meta">
              <div class="top-row">
                <div class="title-wrap">
                  <span class="title">{{ item?.title || item?.type_display || "系统通知" }}</span>
                  <span v-if="!item?.is_read" class="dot"></span>
                </div>
                <span class="time">{{ formatDateTimeMinute(item?.created) }}</span>
              </div>

              <div class="content">{{ item?.content || "" }}</div>

              <div class="bottom-row">
                <span class="actor">{{ item?.actor?.username || "系统" }}</span>
                <span
                  v-if="markLoadingMap?.[item?.id]"
                  class="reading"
                >
                  <CheckOutlined />
                  标记中
                </span>
                <span v-else class="type-text">{{ item?.type_display || "通知" }}</span>
              </div>
            </div>
          </button>
        </div>

        <div v-if="hasMore" class="more-wrap">
          <a-button :loading="loadingMore" @click="handleLoadMore">
            加载更多
          </a-button>
        </div>
      </a-spin>
    </div>
  </a-drawer>
</template>

<style scoped>
.drawer-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 900;
  color: #111827;
}

.title-unread {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(120, 200, 65, 0.12);
  border: 1px solid rgba(120, 200, 65, 0.22);
  color: var(--brand-color);
  font-size: 12px;
  line-height: 1.4;
  font-weight: 900;
}

.read-all-btn {
  padding-inline: 0;
  font-weight: 800;
}

.notification-drawer {
  min-height: 100%;
}

.notification-list {
  display: grid;
  gap: 10px;
}

.notification-item {
  width: 100%;
  text-align: left;
  border: 1px solid #eef2f7;
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.notification-item:hover {
  border-color: rgba(120, 200, 65, 0.4);
  background: rgba(120, 200, 65, 0.04);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
}

.notification-item.unread {
  border-color: rgba(120, 200, 65, 0.3);
  background: rgba(120, 200, 65, 0.05);
}

.left-icon {
  position: relative;
  flex: none;
}

.type-icon {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--brand-color);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  box-shadow: 0 2px 8px rgba(120, 200, 65, 0.25);
}

.meta {
  min-width: 0;
  flex: 1;
}

.top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.title-wrap {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 14px;
  font-weight: 900;
  color: #111827;
  line-height: 1.4;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ef4444;
  flex: none;
}

.time {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.content {
  margin-top: 8px;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.65;
  word-break: break-word;
}

.bottom-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.actor,
.type-text,
.reading {
  font-size: 12px;
  font-weight: 800;
  color: #94a3b8;
}

.reading {
  color: var(--brand-color);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.more-wrap {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}
</style>
