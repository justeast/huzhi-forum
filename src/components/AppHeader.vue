<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import {
  HomeOutlined,
  LogoutOutlined,
  MessageOutlined,
  SearchOutlined,
  PlusOutlined,
  UserOutlined,
} from "@ant-design/icons-vue";
import { useAuthStore } from "../stores/auth";

const props = defineProps({
  modelValue: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue", "search"]);

const router = useRouter();
const authStore = useAuthStore();

const keyword = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});
const avatarUrl = computed(() => authStore.avatarUrl);

// 搜索：由父组件决定具体业务（当前首页复用为话题搜索）
const handleSearch = () => {
  const value = (keyword.value || "").trim();
  if (!value) {
    message.info("请输入搜索关键词");
    return;
  }
  emit("search", value);
};

const handleCreateQuestion = () => {
  message.info("提问题功能开发中");
};

const handleWriteAnswer = () => {
  message.info("写回答功能开发中");
};

const handleGotoHome = () => {
  router.push("/home");
};

const handleGotoProfile = () => {
  router.push("/profile");
};

const handleLogout = () => {
  authStore.logout();
  router.push("/auth");
  message.success("已退出登录");
};
</script>

<template>
  <header class="app-header">
    <div class="inner">
      <div class="left" @click="handleGotoHome">
        <div class="logo">乎知</div>
      </div>

      <div class="center">
        <a-input
          v-model:value="keyword"
          class="search"
          size="large"
          allow-clear
          placeholder="搜索你感兴趣的内容..."
          @pressEnter="handleSearch"
        >
          <template #suffix>
            <SearchOutlined class="search-icon" @click="handleSearch" />
          </template>
        </a-input>
      </div>

      <div class="right">
        <a-dropdown :trigger="['click']">
          <a-button class="add-btn" type="primary">
            <PlusOutlined />
          </a-button>
          <template #overlay>
            <a-menu class="header-menu header-create-menu">
              <a-menu-item key="ask" @click="handleCreateQuestion">
                <img src="/ask-question.svg" alt="提问题" class="menu-icon" />
                <span class="menu-text">提问题</span>
              </a-menu-item>
              <a-menu-item key="answer" @click="handleWriteAnswer">
                <img src="/write-answer.svg" alt="写回答" class="menu-icon" />
                <span class="menu-text">写回答</span>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <div class="msg">
          <MessageOutlined class="msg-icon" />
          <span class="msg-text">私信</span>
        </div>

        <a-dropdown :trigger="['click']" placement="bottomRight">
          <div class="avatar-wrap">
            <a-avatar :src="avatarUrl" :size="36" />
          </div>
          <template #overlay>
            <a-menu class="header-menu header-user-menu">
              <a-menu-item disabled>
                <UserOutlined />
                <span class="menu-text">{{
                  authStore.username || "未登录用户"
                  }}</span>
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="profile" @click="handleGotoProfile">
                <HomeOutlined />
                <span class="menu-text">我的主页</span>
              </a-menu-item>
              <a-menu-item key="logout" @click="handleLogout">
                <LogoutOutlined />
                <span class="menu-text">退出</span>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 64px;
  background: #fff;
  border-bottom: 1px solid #eef0f3;
}

.inner {
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.left {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.logo {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: 2px;
  color: var(--brand-color);
  line-height: 1;
}

.center {
  flex: 1;
}

.search :global(.ant-input) {
  border-radius: 18px;
  background: #f6f7f9;
  border-color: transparent;
}

.search :global(.ant-input:focus) {
  border-color: var(--brand-color);
  box-shadow: 0 0 0 2px rgba(120, 200, 65, 0.15);
}

.search-icon {
  color: #9aa5b1;
  cursor: pointer;
}

.search-icon:hover {
  color: var(--brand-color);
}

.right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.add-btn {
  width: 44px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.menu-icon {
  width: 16px;
  height: 16px;
}

.msg {
  width: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
  color: #94a3b8;
}

.msg-icon {
  font-size: 22px;
  color: #9aa5b1;
}

.msg-text {
  margin-top: 2px;
  font-size: 12px;
}

.avatar-wrap {
  cursor: pointer;
}

.menu-text {
  margin-left: 8px;
}

:global(.header-menu .ant-dropdown-menu-item:hover),
:global(.header-menu .ant-dropdown-menu-item-active),
:global(.header-menu .ant-dropdown-menu-item-selected) {
  color: var(--brand-color) !important;
  background: rgba(120, 200, 65, 0.08) !important;
}

:global(.header-menu .ant-dropdown-menu-item:hover .ant-dropdown-menu-title-content),
:global(.header-menu .ant-dropdown-menu-item-active .ant-dropdown-menu-title-content),
:global(.header-menu .ant-dropdown-menu-item-selected .ant-dropdown-menu-title-content) {
  color: var(--brand-color) !important;
}

:global(.header-menu .ant-dropdown-menu-item:hover .anticon),
:global(.header-menu .ant-dropdown-menu-item-active .anticon),
:global(.header-menu .ant-dropdown-menu-item-selected .anticon) {
  color: var(--brand-color) !important;
}

:global(.header-create-menu .menu-icon) {
  opacity: 0.92;
}

:global(.header-create-menu .ant-dropdown-menu-item:hover .menu-icon),
:global(.header-create-menu .ant-dropdown-menu-item-active .menu-icon),
:global(.header-create-menu .ant-dropdown-menu-item-selected .menu-icon) {
  opacity: 1;
}
</style>
