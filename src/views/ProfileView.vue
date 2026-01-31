<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { message } from "ant-design-vue";
import { CameraOutlined, EditOutlined, RightOutlined } from "@ant-design/icons-vue";
import AppHeader from "../components/AppHeader.vue";
import { useAuthStore } from "../stores/auth";
import {
  PROFILE_FOLLOW_TAB,
  PROFILE_FOLLOW_TAB_LIST,
  PROFILE_TAB,
  PROFILE_TAB_LIST,
} from "../constants/profileNav";

const authStore = useAuthStore();

const headerKeyword = ref("");
const handleHeaderSearch = () => {
  message.info("搜索功能开发中");
};

// 编辑区展开/收起动画：使用动态高度，避免固定 max-height 导致的回弹抖动
const expandBeforeEnter = (el) => {
  el.style.boxSizing = "border-box";
  el.style.willChange = "height, opacity, transform";
  el.style.height = "0";
  el.style.opacity = "0";
  el.style.transform = "translateY(6px)";
  el.style.overflow = "hidden";
};

const expandEnter = (el) => {
  const height = el.scrollHeight;
  // 触发一次 reflow，确保过渡生效
  void el.offsetHeight;
  el.style.transition = "height 0.24s ease, opacity 0.18s ease, transform 0.18s ease";
  el.style.height = `${height}px`;
  el.style.opacity = "1";
  el.style.transform = "translateY(0)";
};

const expandAfterEnter = (el) => {
  el.style.boxSizing = "";
  el.style.willChange = "";
  el.style.height = "";
  el.style.opacity = "";
  el.style.transform = "";
  el.style.overflow = "";
  el.style.transition = "";
};

const expandBeforeLeave = (el) => {
  el.style.boxSizing = "border-box";
  el.style.willChange = "height, opacity, transform";
  // 离开时固定为当前可见高度，避免用 scrollHeight 导致先“撑大”再收起的回弹
  const { height } = el.getBoundingClientRect();
  el.style.height = `${height}px`;
  el.style.opacity = "1";
  el.style.transform = "translateY(0)";
  el.style.overflow = "hidden";
};

const expandLeave = (el) => {
  void el.offsetHeight;
  el.style.transition = "height 0.24s ease, opacity 0.18s ease, transform 0.18s ease";
  el.style.height = "0";
  el.style.opacity = "0";
  el.style.transform = "translateY(-6px)";
};

const expandAfterLeave = (el) => {
  el.style.boxSizing = "";
  el.style.willChange = "";
  el.style.height = "";
  el.style.opacity = "";
  el.style.transform = "";
  el.style.overflow = "";
  el.style.transition = "";
};

// 页面模式：默认展示内容（回答/提问/收藏/关注），编辑资料时切换到资料编辑区
const pageMode = ref("feed"); // feed | edit-profile

const activeTab = ref(PROFILE_TAB.ANSWERS);
const activeFollowTab = ref(PROFILE_FOLLOW_TAB.QUESTIONS);

// 临时占位数据（后续对接接口再替换）
const mockAnswerList = ref([
  { id: "a1", title: "前端开发中，React 相比 Vue 有哪些核心优势？", rightText: "42 个回答" },
  { id: "a2", title: "如何看待 2024 年的人工智能发展趋势？", rightText: "156 个回答" },
  { id: "a3", title: "大学生如何高效地准备毕业设计？", rightText: "8 个回答" },
]);

const mockQuestionList = ref([
  { id: "q1", title: "易上手的编程语言有哪些？", rightText: "3 个回答" },
  { id: "q2", title: "如何系统学习计算机网络？", rightText: "12 个回答" },
]);

const mockCollectionList = ref([
  { id: "c1", title: "机器学习入门路线推荐", rightText: "收藏于 2 天前" },
  { id: "c2", title: "如何写出高质量的前端简历？", rightText: "收藏于 1 周前" },
]);

const mockFollowQuestionList = ref([
  { id: "fq1", title: "前端开发中，React 相比 Vue 有哪些核心优势？", rightText: "42 个回答" },
  { id: "fq2", title: "如何看待 2024 年的人工智能发展趋势？", rightText: "156 个回答" },
]);

const mockFollowTopicList = ref([
  { id: "ft1", title: "前端开发", rightText: "12.5k 人关注" },
  { id: "ft2", title: "机器学习", rightText: "56k 人关注" },
]);

const tabCount = computed(() => ({
  [PROFILE_TAB.ANSWERS]: mockAnswerList.value.length,
  [PROFILE_TAB.QUESTIONS]: mockQuestionList.value.length,
  [PROFILE_TAB.COLLECTIONS]: mockCollectionList.value.length,
  [PROFILE_TAB.FOLLOWS]:
    mockFollowQuestionList.value.length + mockFollowTopicList.value.length,
}));

const currentFeedList = computed(() => {
  if (activeTab.value === PROFILE_TAB.ANSWERS) return mockAnswerList.value;
  if (activeTab.value === PROFILE_TAB.QUESTIONS) return mockQuestionList.value;
  if (activeTab.value === PROFILE_TAB.COLLECTIONS) return mockCollectionList.value;

  // 关注 Tab
  if (activeFollowTab.value === PROFILE_FOLLOW_TAB.QUESTIONS) {
    return mockFollowQuestionList.value;
  }
  return mockFollowTopicList.value;
});

const handleSelectTab = (tab) => {
  activeTab.value = tab;
  if (tab === PROFILE_TAB.FOLLOWS) {
    // 默认进入“我关注的问题”
    activeFollowTab.value = PROFILE_FOLLOW_TAB.QUESTIONS;
  }
};

// 资料展示/编辑数据（后续接接口再替换）
const profile = ref({
  username: authStore.username || "未登录用户",
  bio: "正在努力完成毕业设计的计算机系学生",
  email: "student@huzhi.com",
  phone: "138****8888",
});

// 图片预览（本地预览，不上传）
const defaultCover = "/default-cover-image.png";
const coverUrl = ref(defaultCover);
const avatarUrl = computed(() => authStore.avatarUrl);
const avatarPreviewUrl = ref("");
const coverPreviewUrl = ref("");

const avatarInputRef = ref(null);
const coverInputRef = ref(null);

const effectiveAvatarUrl = computed(
  () => avatarPreviewUrl.value || avatarUrl.value,
);
const effectiveCoverUrl = computed(
  () => coverPreviewUrl.value || coverUrl.value,
);

const revokeUrlSafely = (url) => {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // 忽略
  }
};

onBeforeUnmount(() => {
  revokeUrlSafely(avatarPreviewUrl.value);
  revokeUrlSafely(coverPreviewUrl.value);
});

const openAvatarPicker = () => {
  avatarInputRef.value?.click?.();
};

const openCoverPicker = () => {
  coverInputRef.value?.click?.();
};

const handleAvatarChange = (event) => {
  const file = event?.target?.files?.[0];
  if (!file) return;
  revokeUrlSafely(avatarPreviewUrl.value);
  avatarPreviewUrl.value = URL.createObjectURL(file);
  message.success("头像已更新预览");
};

const handleCoverChange = (event) => {
  const file = event?.target?.files?.[0];
  if (!file) return;
  revokeUrlSafely(coverPreviewUrl.value);
  coverPreviewUrl.value = URL.createObjectURL(file);
  message.success("封面已更新预览");
};

// 资料编辑：一次只编辑一个字段（用户名编辑行与其它字段互斥）
const editingField = ref(null); // bio | email | phone | null
const isEditingUsername = ref(false);

// 行内编辑的开关：将“编辑状态”和“是否展开 editor”分离，避免收起时文本提前出现导致抖动
const editorOpen = ref(false);
const pendingFieldToOpen = ref(null);

const draft = ref({
  username: profile.value.username,
  bio: profile.value.bio,
  email: profile.value.email,
  phone: profile.value.phone,
});

const enterEditProfile = () => {
  pageMode.value = "edit-profile";
  editingField.value = null;
  isEditingUsername.value = false;
  editorOpen.value = false;
  pendingFieldToOpen.value = null;
  draft.value = { ...profile.value };
};

const backToFeed = () => {
  pageMode.value = "feed";
  editingField.value = null;
  isEditingUsername.value = false;
  editorOpen.value = false;
  pendingFieldToOpen.value = null;
};

const openFieldEditor = (field) => {
  if (isEditingUsername.value) isEditingUsername.value = false;
  if (editingField.value && editingField.value !== field) {
    pendingFieldToOpen.value = field;
    editorOpen.value = false;
    return;
  }

  editingField.value = field;
  editorOpen.value = true;
};

const saveField = (field) => {
  profile.value[field] = draft.value[field];
  message.success("已保存");
  editorOpen.value = false;
};

const cancelFieldEdit = (field) => {
  draft.value[field] = profile.value[field];
  editorOpen.value = false;
};

const handleEditorAfterLeave = (field) => {
  if (editingField.value !== field) return;
  if (editorOpen.value) return;

  // editor 收起完成后再恢复展示文本，避免出现“先显示文本 + 再收起”造成视觉抖动
  editingField.value = null;

  if (pendingFieldToOpen.value) {
    const nextField = pendingFieldToOpen.value;
    pendingFieldToOpen.value = null;
    openFieldEditor(nextField);
  }
};

const openUsernameEditor = () => {
  if (editingField.value) {
    editorOpen.value = false;
    pendingFieldToOpen.value = null;
    editingField.value = null;
  }
  isEditingUsername.value = true;
};

const cancelUsernameEdit = () => {
  draft.value.username = profile.value.username;
  isEditingUsername.value = false;
};

const saveUsername = () => {
  profile.value.username = draft.value.username;
  message.success("用户名已保存");
  isEditingUsername.value = false;
};
</script>

<template>
  <div class="profile-page">
    <AppHeader v-model="headerKeyword" @search="handleHeaderSearch" />

    <section class="cover" :class="{ editing: pageMode === 'edit-profile' }"
      :style="{ backgroundImage: `url(${effectiveCoverUrl})` }">
      <div class="cover-mask"></div>

      <div class="cover-edit">
        <button class="cover-btn" type="button" @click="openCoverPicker">
          <CameraOutlined />
          <span>修改我的封面背景</span>
        </button>
      </div>

      <input ref="coverInputRef" class="file-input" type="file" accept="image/*" @change="handleCoverChange" />
    </section>

    <div class="container">
      <section class="hero-card">
        <div class="avatar-block" @click="openAvatarPicker">
          <div class="avatar-wrap">
            <img class="avatar" :src="effectiveAvatarUrl" alt="头像" />
            <div class="avatar-overlay" :class="{ editing: pageMode === 'edit-profile' }">
              <CameraOutlined />
              <div class="overlay-text">修改我的头像</div>
            </div>
          </div>
          <input ref="avatarInputRef" class="file-input" type="file" accept="image/*" @change="handleAvatarChange" />
        </div>

        <div class="hero-main">
          <Transition name="fade-slide" mode="out-in">
            <div v-if="pageMode === 'feed'" key="hero-view" class="hero-view">
              <div class="hero-top">
                <div class="hero-title">{{ profile.username }}</div>
                <button class="edit-profile-btn" type="button" @click="enterEditProfile">
                  编辑个人资料
                </button>
              </div>
              <div class="hero-sub">{{ profile.bio }}</div>
            </div>

            <div v-else key="hero-edit" class="hero-edit">
              <div class="hero-top">
                <div class="hero-title">
                  {{ profile.username }}
                  <button class="inline-edit" type="button" @click="openUsernameEditor">
                    <EditOutlined />
                    <span>修改</span>
                  </button>
                </div>

                <button class="back-link" type="button" @click="backToFeed">
                  返回我的主页
                  <RightOutlined />
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </section>

      <Transition name="fade-slide" mode="out-in">
        <section v-if="pageMode === 'feed'" key="feed" class="content">
          <main class="main">
            <div class="content-card">
              <div class="profile-tabs">
                <button
                  v-for="tab in PROFILE_TAB_LIST"
                  :key="tab.key"
                  class="ptab"
                  :class="{ active: activeTab === tab.key }"
                  type="button"
                  @click="handleSelectTab(tab.key)"
                >
                  {{ tab.label }} <span class="count">{{ tabCount[tab.key] }}</span>
                </button>
              </div>

              <div v-if="activeTab === PROFILE_TAB.FOLLOWS" class="follow-subtabs">
                <button
                  v-for="tab in PROFILE_FOLLOW_TAB_LIST"
                  :key="tab.key"
                  class="subtab"
                  :class="{ active: activeFollowTab === tab.key }"
                  type="button"
                  @click="activeFollowTab = tab.key"
                >
                  {{ tab.label }}
                </button>
              </div>

              <div class="feed-list">
                <a-empty v-if="currentFeedList.length === 0" description="暂无内容" />
                <div v-for="item in currentFeedList" :key="item.id" class="feed-row" role="button" tabindex="0"
                  @click="message.info('详情功能开发中')">
                  <div class="row-title">{{ item.title }}</div>
                  <div class="row-right">{{ item.rightText }}</div>
                </div>
              </div>
            </div>
          </main>

          <aside class="aside">
            <a-card class="side-card" :bordered="false">
              <div class="side-title">个人成就</div>
              <div class="achievements">
                <div class="ach-item">
                  <span class="ach-label">获得</span>
                  <span class="ach-value">36174</span>
                  <span class="ach-suffix">次赞同</span>
                </div>
                <div class="ach-item">
                  <span class="ach-label">作出</span>
                  <span class="ach-value">45</span>
                  <span class="ach-suffix">次回答</span>
                </div>
              </div>
            </a-card>

            <a-card class="side-card side-footer" :bordered="false">
              <div class="side-slogan">有问题，就会有答案</div>
              <div class="side-copy">&copy; {{ new Date().getFullYear() }} 乎知</div>
            </a-card>
          </aside>
        </section>

        <section v-else key="edit" class="edit-panel">
          <div class="edit-layout">
            <div class="edit-spacer" aria-hidden="true"></div>
            <div class="edit-content">
              <div class="edit-card">
                <Transition name="expand" @before-enter="expandBeforeEnter" @enter="expandEnter"
                  @after-enter="expandAfterEnter" @before-leave="expandBeforeLeave" @leave="expandLeave"
                  @after-leave="expandAfterLeave">
                  <div v-if="isEditingUsername" class="expand-wrap">
                    <div class="edit-row editing username-row">
                      <div class="label">用户名</div>
                      <div class="value">
                        <a-input v-model:value="draft.username" size="large" class="edit-input" />
                        <div class="actions">
                          <a-button type="primary" @click.stop="saveUsername">保存</a-button>
                          <a-button @click.stop="cancelUsernameEdit">取消</a-button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Transition>

                <div class="edit-row" :class="{ editing: editingField === 'bio' }" role="button" tabindex="0"
                  @click="openFieldEditor('bio')">
                  <div class="label">个人简介</div>
                  <div class="value">
                    <div v-if="editingField !== 'bio'" class="text">{{ profile.bio }}</div>
                    <button class="row-edit-btn" type="button" @click.stop="openFieldEditor('bio')">
                      <EditOutlined />
                      <span>修改</span>
                    </button>

                    <Transition name="expand" @before-enter="expandBeforeEnter" @enter="expandEnter"
                      @after-enter="expandAfterEnter" @before-leave="expandBeforeLeave" @leave="expandLeave"
                      @after-leave="(el) => { expandAfterLeave(el); handleEditorAfterLeave('bio'); }">
                      <div v-if="editorOpen && editingField === 'bio'" class="editor">
                        <a-textarea v-model:value="draft.bio" :rows="3" class="edit-textarea" />
                        <div class="actions">
                          <a-button type="primary" @click.stop="saveField('bio')">保存</a-button>
                          <a-button @click.stop="cancelFieldEdit('bio')">取消</a-button>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>

                <div class="edit-row" :class="{ editing: editingField === 'email' }" role="button" tabindex="0"
                  @click="openFieldEditor('email')">
                  <div class="label">邮箱</div>
                  <div class="value">
                    <div v-if="editingField !== 'email'" class="text">{{ profile.email }}</div>
                    <button class="row-edit-btn" type="button" @click.stop="openFieldEditor('email')">
                      <EditOutlined />
                      <span>修改</span>
                    </button>

                    <Transition name="expand" @before-enter="expandBeforeEnter" @enter="expandEnter"
                      @after-enter="expandAfterEnter" @before-leave="expandBeforeLeave" @leave="expandLeave"
                      @after-leave="(el) => { expandAfterLeave(el); handleEditorAfterLeave('email'); }">
                      <div v-if="editorOpen && editingField === 'email'" class="editor">
                        <a-input v-model:value="draft.email" size="large" class="edit-input" />
                        <div class="actions">
                          <a-button type="primary" @click.stop="saveField('email')">保存</a-button>
                          <a-button @click.stop="cancelFieldEdit('email')">取消</a-button>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>

                <div class="edit-row" :class="{ editing: editingField === 'phone' }" role="button" tabindex="0"
                  @click="openFieldEditor('phone')">
                  <div class="label">手机号</div>
                  <div class="value">
                    <div v-if="editingField !== 'phone'" class="text">{{ profile.phone }}</div>
                    <button class="row-edit-btn" type="button" @click.stop="openFieldEditor('phone')">
                      <EditOutlined />
                      <span>修改</span>
                    </button>

                    <Transition name="expand" @before-enter="expandBeforeEnter" @enter="expandEnter"
                      @after-enter="expandAfterEnter" @before-leave="expandBeforeLeave" @leave="expandLeave"
                      @after-leave="(el) => { expandAfterLeave(el); handleEditorAfterLeave('phone'); }">
                      <div v-if="editorOpen && editingField === 'phone'" class="editor">
                        <a-input v-model:value="draft.phone" size="large" class="edit-input" />
                        <div class="actions">
                          <a-button type="primary" @click.stop="saveField('phone')">保存</a-button>
                          <a-button @click.stop="cancelFieldEdit('phone')">取消</a-button>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
:global(:root) {
  --bg: #f5f7fb;
  --card: #ffffff;
  --line: #eef0f3;
  --text: #1f2d3d;
  --subtle: #8c9ba5;
}

.profile-page {
  min-height: 100vh;
  background: var(--bg);
}

.cover {
  position: relative;
  height: 280px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.cover-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.22);
}

.cover-edit {
  position: absolute;
  top: 16px;
  right: 18px;
  opacity: 0;
  transform: translateY(-6px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  z-index: 2;
}

.cover:hover .cover-edit {
  opacity: 1;
  transform: translateY(0);
}

.cover.editing .cover-edit {
  opacity: 1;
  transform: translateY(0);
}

.cover-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  padding: 8px 14px;
  border-radius: 10px;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: background 0.18s ease, border-color 0.18s ease;
}

.cover-btn:hover {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.8);
}

.file-input {
  display: none;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px 60px;
}

.hero-card {
  position: relative;
  margin-top: -82px;
  background: #fff;
  border-radius: 14px;
  border: 1px solid var(--line);
  display: flex;
  gap: 18px;
  padding: 18px 18px 16px;
}

.avatar-block {
  flex: none;
  margin-top: -44px;
  cursor: pointer;
}

.avatar-wrap {
  position: relative;
  width: 156px;
  height: 156px;
  border-radius: 14px;
  background: #fff;
  padding: 6px;
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.18);
}

.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
  display: block;
}

.avatar-overlay {
  position: absolute;
  inset: 6px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.avatar-wrap:hover .avatar-overlay {
  opacity: 1;
}

.avatar-overlay.editing {
  opacity: 1;
}

.overlay-text {
  font-size: 13px;
  font-weight: 600;
}

.hero-main {
  flex: 1;
  min-width: 0;
  padding-top: 14px;
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.hero-title {
  font-size: 26px;
  font-weight: 900;
  color: #111827;
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.hero-sub {
  margin-top: 8px;
  color: #475569;
  font-size: 14px;
}

.edit-profile-btn {
  border: 1px solid var(--brand-color);
  background: #fff;
  color: var(--brand-color);
  padding: 10px 18px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  transition: background 0.18s ease, color 0.18s ease;
}

.edit-profile-btn:hover {
  background: var(--brand-color);
  color: #fff;
}

.inline-edit {
  border: none;
  background: transparent;
  color: var(--brand-color);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
}

.inline-edit:hover {
  color: var(--brand-color-dark);
}

.back-link {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #64748b;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.back-link:hover {
  color: var(--brand-color);
}

.content {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 18px;
}

.content-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
}

.profile-tabs {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
}

.ptab {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  padding: 10px 6px;
  position: relative;
}

.ptab .count {
  margin-left: 6px;
  color: #94a3b8;
  font-weight: 700;
}

.ptab.active {
  color: var(--brand-color);
}

.ptab.active::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 52px;
  height: 2px;
  background: var(--brand-color);
  transform: translateX(-50%);
  border-radius: 2px;
}

.follow-subtabs {
  display: inline-flex;
  align-items: center;
  gap: 0;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 3px;
  margin: 12px 0 10px 18px;
}

.subtab {
  border: none;
  background: transparent;
  color: #111827;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
  transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.subtab.active {
  background: #fff;
  color: var(--brand-color);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.subtab:hover {
  color: var(--brand-color);
}

.feed-list {
  padding: 0;
}

.feed-row {
  padding: 16px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.feed-row+.feed-row {
  border-top: 1px solid #f0f2f5;
}

.feed-row:hover {
  background: rgba(120, 200, 65, 0.06);
}

.row-title {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
  line-height: 1.4;
}

.feed-row:hover .row-title {
  color: var(--brand-color);
}

.row-right {
  color: #94a3b8;
  font-size: 13px;
  flex: none;
}

.aside {
  position: sticky;
  top: 82px;
  height: fit-content;
}

.side-card {
  border-radius: 12px;
  border: 1px solid var(--line);
}

.side-title {
  font-weight: 800;
  font-size: 16px;
  color: #111827;
  margin-bottom: 10px;
}

.achievements {
  display: grid;
  gap: 12px;
}

.ach-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: #111827;
  font-weight: 700;
}

.ach-label {
  color: #64748b;
  font-weight: 700;
}

.ach-value {
  color: var(--brand-color);
  font-size: 18px;
  font-weight: 900;
}

.ach-suffix {
  color: #64748b;
  font-weight: 700;
}

.side-footer {
  margin-top: 14px;
}

.side-slogan {
  color: #64748b;
  font-weight: 700;
}

.side-copy {
  margin-top: 6px;
  color: #94a3b8;
  font-size: 12px;
}

.edit-panel {
  margin-top: 18px;
  background: transparent;
}

.edit-layout {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  padding: 0 18px;
}

.edit-spacer {
  flex: none;
  width: 156px;
}

.edit-content {
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: 920px;
}

.edit-card {
  background: transparent;
  border: none;
  border-radius: 0;
}

.edit-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 18px;
  padding: 22px 0;
  align-items: start;
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  transition: border-color 0.18s ease;
}

.edit-row.editing {
  cursor: default;
  border-bottom-color: var(--brand-color);
}

.edit-row:hover {
  border-bottom-color: var(--brand-color);
}

.label {
  font-weight: 900;
  color: #111827;
  font-size: 18px;
  padding-top: 8px;
}

.value {
  position: relative;
  min-width: 0;
}

.text {
  font-size: 16px;
  font-weight: 500;
  color: #111827;
  padding-top: 8px;
}

.row-edit-btn {
  position: absolute;
  right: 0;
  top: 8px;
  border: none;
  background: transparent;
  color: var(--brand-color);
  font-weight: 800;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.18s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.edit-row:hover .row-edit-btn {
  opacity: 1;
}

.edit-row.editing .row-edit-btn {
  opacity: 0;
  pointer-events: none;
}

.editor {
  margin-top: 10px;
  cursor: default;
}

.actions {
  margin-top: 14px;
  display: flex;
  gap: 14px;
}

.edit-input :global(.ant-input),
.edit-textarea :global(.ant-input) {
  border-color: var(--brand-color) !important;
  box-shadow: 0 0 0 2px rgba(120, 200, 65, 0.12);
  border-radius: 0 !important;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (max-width: 1100px) {
  .content {
    grid-template-columns: 1fr;
  }

  .aside {
    position: static;
  }

  .hero-card {
    flex-direction: column;
  }

  .avatar-block {
    margin-top: -64px;
  }

  .edit-row {
    grid-template-columns: 1fr;
  }

  .edit-layout {
    padding: 0;
  }

  .edit-spacer {
    display: none;
  }
}
</style>
