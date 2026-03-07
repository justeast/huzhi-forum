<script setup>
import { computed } from "vue";
import { MessageOutlined, UserAddOutlined } from "@ant-design/icons-vue";
import { formatCount } from "../utils/format";
import { useChatStore } from "../stores/chat";

const props = defineProps({
  user: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  // 是否启用“点击头像进入用户主页”
  enableUserLink: { type: Boolean, default: false },
  // 当前登录用户 id：用于判断作者是否为“我自己”
  selfUserId: { type: String, default: "" },
  // 关注按钮 loading
  followLoading: { type: Boolean, default: false },
  // 是否禁用关注按钮（例如：作者是自己）
  disableFollow: { type: Boolean, default: false },
});

const emit = defineEmits(["user-click", "follow-toggle"]);
const chatStore = useChatStore();

const avatarUrl = computed(() => props.user?.avatar || "/default-avatar.png");
const username = computed(() => props.user?.username || "匿名用户");
const bio = computed(() => props.user?.bio || "暂无简介");

const isSelfAuthor = computed(() => {
  const uid = String(props.user?.id || "").trim();
  const self = String(props.selfUserId || "").trim();
  if (!uid || !self) return false;
  return uid === self;
});

const handleClickUser = () => {
  if (!props.enableUserLink) return;
  const uid = props.user?.id;
  if (!uid) return;
  emit("user-click", uid);
};

const handleFollow = () => {
  if (isSelfAuthor.value) return;
  const uid = props.user?.id;
  if (!uid) return;
  emit("follow-toggle", uid);
};

const handleMessage = () => {
  if (isSelfAuthor.value) return;
  const uid = props.user?.id;
  if (!uid) return;
  chatStore.openChatWithUser(uid);
};
</script>

<template>
  <div class="author-card">
    <div v-if="loading" class="skeleton" aria-hidden="true">
      <div class="skeleton-head">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-meta">
          <div class="skeleton-line w-60"></div>
          <div class="skeleton-line w-90"></div>
        </div>
      </div>
      <div class="skeleton-stats">
        <div class="skeleton-line w-30"></div>
        <div class="skeleton-line w-30"></div>
        <div class="skeleton-line w-30"></div>
      </div>
    </div>

    <div v-else class="body">
      <div class="head">
        <div
          class="avatar-link"
          :class="{ clickable: enableUserLink }"
          :role="enableUserLink ? 'button' : undefined"
          :tabindex="enableUserLink ? 0 : undefined"
          @click.stop="handleClickUser"
          @keydown.enter.prevent="handleClickUser"
          @keydown.space.prevent="handleClickUser"
        >
          <a-avatar :size="44" :src="avatarUrl" />
        </div>
        <div class="meta">
          <div class="name-row">
            <div class="name">{{ username }}</div>
            <div v-if="isSelfAuthor" class="self-badge">我</div>
            <div v-else-if="user?.is_mutual" class="mutual">
              <img src="/mutual-follow.svg" alt="互关" />
              <span>互关</span>
            </div>
          </div>
          <div class="bio">{{ bio }}</div>
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="label">提问</div>
          <div class="value">{{ formatCount(user?.question_count || 0) }}</div>
        </div>
        <div class="stat">
          <div class="label">回答</div>
          <div class="value">{{ formatCount(user?.answer_count || 0) }}</div>
        </div>
        <div class="stat">
          <div class="label">关注者</div>
          <div class="value">{{ formatCount(user?.follower_count || 0) }}</div>
        </div>
      </div>

      <div v-if="!isSelfAuthor" class="actions">
        <button
          class="btn primary"
          type="button"
          :disabled="disableFollow || followLoading"
          @click="handleFollow"
        >
          <UserAddOutlined />
          <span>
            <template v-if="followLoading">处理中</template>
            <template v-else>{{ user?.is_following ? "已关注" : "关注" }}</template>
          </span>
        </button>
        <button class="btn ghost" type="button" @click="handleMessage">
          <MessageOutlined />
          <span>私信</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.author-card {
  padding: 0;
}

.head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.avatar-link.clickable {
  cursor: pointer;
}

.avatar-link.clickable:focus-visible {
  outline: 2px solid rgba(120, 200, 65, 0.6);
  outline-offset: 2px;
  border-radius: 10px;
}

.meta {
  min-width: 0;
  flex: 1;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.name {
  font-weight: 900;
  font-size: 16px;
  color: #111827;
  line-height: 1.2;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.self-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(120, 200, 65, 0.22);
  background: rgba(120, 200, 65, 0.12);
  color: var(--brand-color);
  font-weight: 900;
  font-size: 12px;
  flex: none;
  line-height: 1.2;
}

.mutual {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(120, 200, 65, 0.12);
  border: 1px solid rgba(120, 200, 65, 0.2);
  color: var(--brand-color);
  font-weight: 900;
  font-size: 12px;
  flex: none;
}

.mutual img {
  width: 14px;
  height: 14px;
  display: block;
}

.bio {
  margin-top: 6px;
  color: #64748b;
  font-weight: 700;
  font-size: 13px;
  line-height: 1.6;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.stats {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.stat {
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 10px;
  padding: 10px 10px 8px;
}

.stat .label {
  color: #94a3b8;
  font-weight: 800;
  font-size: 12px;
}

.stat .value {
  margin-top: 6px;
  font-size: 16px;
  font-weight: 900;
  color: #111827;
  line-height: 1.1;
}

.actions {
  margin-top: 14px;
  display: flex;
  gap: 10px;
}

.btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 900;
  border: 1px solid transparent;
  background: #fff;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  flex: 1;
}

.btn.primary {
  background: var(--brand-color);
  border-color: var(--brand-color);
  color: #fff;
}

.btn.primary:hover {
  background: var(--brand-color-dark);
  border-color: var(--brand-color-dark);
}

.btn.ghost {
  border-color: rgba(148, 163, 184, 0.3);
  color: #64748b;
}

.btn.ghost:hover {
  border-color: rgba(120, 200, 65, 0.5);
  color: var(--brand-color);
}

.skeleton-head {
  display: flex;
  gap: 12px;
}

.skeleton-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #eef2f7;
  flex: none;
}

.skeleton-meta {
  flex: 1;
  display: grid;
  gap: 8px;
  align-content: start;
}

.skeleton-line {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #eef2f7 0%, #f6f8fb 40%, #eef2f7 80%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
}

.w-60 {
  width: 60%;
}

.w-90 {
  width: 90%;
}

.skeleton-stats {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.w-30 {
  width: 100%;
  height: 14px;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 0% 0%;
  }
  100% {
    background-position: -200% 0%;
  }
}
</style>
