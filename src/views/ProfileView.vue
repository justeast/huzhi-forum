<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useRoute, useRouter } from "vue-router";
import {
  CameraOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  MessageOutlined,
  PlusOutlined,
  RightOutlined,
  UserAddOutlined,
} from "@ant-design/icons-vue";
import AppHeader from "../components/AppHeader.vue";
import TopicList from "../components/TopicList.vue";
import FollowQuestionList from "../components/FollowQuestionList.vue";
import UserAnswerList from "../components/UserAnswerList.vue";
import UserQuestionList from "../components/UserQuestionList.vue";
import ProfileFollowUsersPanel from "../components/ProfileFollowUsersPanel.vue";
import UserFollowList from "../components/UserFollowList.vue";
import CollectionAnswerDrawer from "../components/CollectionAnswerDrawer.vue";
import { useAuthStore } from "../stores/auth";
import { useTopicFollowStore } from "../stores/topicFollow";
import { useExpandTransition } from "../composables/useExpandTransition";
import {
  fetchOtherUserProfile,
  fetchFollowingUsers,
  fetchUserAchievements,
  fetchUserCard,
  fetchUserProfile,
  patchUserProfile,
  toggleUserFollow,
} from "../api/user";
import { fetchUserAnswerList, voteAnswer } from "../api/answer";
import { fetchFollowingQuestionList, fetchUserQuestionList } from "../api/question";
import { fetchFollowingTopics, toggleTopicFollow } from "../api/topic";
import { uploadToCos } from "../utils/cosUploader";
import {
  createCollectionFolder,
  deleteCollectionFolder,
  fetchAllCollections,
  updateCollectionFolder,
} from "../api/collection";
import { formatDateTimeMinute } from "../utils/format";
import { VOTE_STATUS } from "../constants/vote";
import {
  PROFILE_FOLLOW_TAB,
  PROFILE_FOLLOW_TAB_LIST,
  PROFILE_TAB,
  PROFILE_TAB_LIST,
} from "../constants/profileNav";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const topicFollowStore = useTopicFollowStore();

const selfUserId = computed(() => String(authStore.userId || "").trim());
const routeUserId = computed(() => String(route.params?.id || "").trim());
// /profile 为本人主页；/user/:id 为他人主页（当 id === self 时重定向回 /profile）
const isOtherProfile = computed(
  () => Boolean(routeUserId.value) && routeUserId.value !== selfUserId.value,
);
const canEditProfile = computed(() => !isOtherProfile.value);
const targetUserId = computed(() =>
  isOtherProfile.value ? routeUserId.value : selfUserId.value,
);

watch(
  [routeUserId, selfUserId],
  () => {
    // 访问 /user/{自己} 时，统一跳回 /profile，避免两套地址造成体验割裂
    if (!routeUserId.value) return;
    if (!selfUserId.value) return;
    if (routeUserId.value !== selfUserId.value) return;
    router.replace("/profile");
  },
  { immediate: true },
);

const headerKeyword = ref("");
const handleHeaderSearch = () => {
  message.info("搜索功能开发中");
};

const profileLoading = ref(false);
const profileLoadError = ref("");
const profileSaving = ref(false);
const avatarUploading = ref(false);
const coverUploading = ref(false);

const achievementLoading = ref(false);
const achievementError = ref("");
const achievements = ref({
  agree_count: 0,
  answer_count: 0,
  follower_count: 0,
});

// 他人主页：关注状态仅取 /card/ 的 is_following / is_mutual
const cardLoading = ref(false);
const card = ref(null);
const followLoading = ref(false);

const collectionLoading = ref(false);
const collectionError = ref("");
// 收藏夹数量：加载完成前为 null（未知），Tab 数量位置显示骨架占位
const collectionCount = ref(null);
const collectionList = ref([]);

// 收藏夹详情：抽屉展示收藏夹内回答列表
const collectionDetailOpen = ref(false);
const activeCollection = ref(null);

const createCollectionOpen = ref(false);
const createCollectionLoading = ref(false);
const createCollectionForm = ref({
  title: "",
  description: "",
  is_public: true,
});

const editCollectionOpen = ref(false);
const editCollectionLoading = ref(false);
const editCollectionId = ref(null);
const editCollectionOriginal = ref(null);
const editCollectionForm = ref({
  title: "",
  description: "",
  is_public: true,
});

// 收藏夹删除：一次只处理一个，避免同时删除导致状态混乱
const deletingCollectionId = ref(null);

// 编辑区展开/收起动画：抽成 composable，避免动画逻辑与业务代码耦合
const {
  beforeEnter: expandBeforeEnter,
  enter: expandEnter,
  afterEnter: expandAfterEnter,
  beforeLeave: expandBeforeLeave,
  leave: expandLeave,
  afterLeave: expandAfterLeave,
} = useExpandTransition();

// 页面模式：默认展示内容（回答/提问/收藏/关注），编辑资料时切换到资料编辑区
const pageMode = ref("feed"); // feed | edit-profile

const activeTab = ref(PROFILE_TAB.ANSWERS);
const activeFollowTab = ref(PROFILE_FOLLOW_TAB.QUESTIONS);

// 回答列表：展示“我回答过的问题”与回答摘要
const ANSWER_PAGE_SIZE = 10;
const answerCount = ref(null);
const answerList = ref([]);
const answerPage = ref(0);
const answerHasMore = ref(false);
const answerLoading = ref(false);
const answerLoadingMore = ref(false);
const answerVoteLoadingMap = ref({});

// 提问列表：展示“我提出的问题”
const QUESTION_PAGE_SIZE = 10;
const userQuestionCount = ref(null);
const userQuestionList = ref([]);
const userQuestionPage = ref(0);
const userQuestionHasMore = ref(false);
const userQuestionLoading = ref(false);
const userQuestionLoadingMore = ref(false);

// 关注-问题：仅展示标题 + 回答数，支持无限滚动加载更多
const FOLLOW_QUESTION_PAGE_SIZE = 10;
const followQuestionList = ref([]);
const followQuestionPage = ref(0);
const followQuestionHasMore = ref(false);
const followQuestionLoading = ref(false);
const followQuestionLoadingMore = ref(false);

// 关注-话题：复用 TopicList，支持取消关注并从列表移除
const FOLLOW_TOPIC_PAGE_SIZE = 20;
const followTopicList = ref([]);
const followTopicPage = ref(0);
const followTopicHasMore = ref(false);
const followTopicLoading = ref(false);
const followTopicLoadingMore = ref(false);
const followTopicFollowLoadingMap = ref({});

// 关注-用户：他人主页仅展示“Ta关注的人”（不展示“关注Ta的人”）
const FOLLOW_USER_PAGE_SIZE = 20;
const followUserList = ref([]);
const followUserPage = ref(0);
const followUserHasMore = ref(false);
const followUserLoading = ref(false);
const followUserLoadingMore = ref(false);
const followUserActionLoadingMap = ref({});

const mergeById = (items, incoming) => {
  const map = new Map((items || []).map((t) => [t?.id, t]));
  (incoming || []).forEach((t) => {
    if (!t?.id) return;
    if (map.has(t.id)) {
      map.set(t.id, { ...map.get(t.id), ...t });
    } else {
      map.set(t.id, t);
    }
  });
  return Array.from(map.values());
};

const fetchUserAnswers = async ({ reset } = { reset: false }) => {
  if (answerLoading.value || answerLoadingMore.value) return;
  if (!reset && !answerHasMore.value) return;

  if (reset) {
    answerPage.value = 0;
    // 首次拉取前 unknown，避免组件的 IntersectionObserver 过早触发 load-more
    answerHasMore.value = false;
    answerList.value = [];
    answerLoading.value = true;
  } else {
    answerLoadingMore.value = true;
  }

  const page = reset ? 1 : answerPage.value + 1;

  try {
    const data = await fetchUserAnswerList({
      page,
      size: ANSWER_PAGE_SIZE,
      user_id: isOtherProfile.value ? targetUserId.value : undefined,
    });
    if (answerCount.value === null) {
      answerCount.value = Math.max(0, Number(data?.count || 0));
    }
    const results = data?.results || [];
    answerList.value = mergeById(answerList.value, results);
    answerPage.value = page;
    answerHasMore.value = Boolean(data?.next);
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "获取回答列表失败");
  } finally {
    answerLoading.value = false;
    answerLoadingMore.value = false;
  }
};

const ensureAnswersLoaded = () => {
  if (answerLoading.value) return;
  if (answerList.value.length > 0) return;
  fetchUserAnswers({ reset: true });
};

const handleLoadMoreAnswers = () => {
  fetchUserAnswers({ reset: false });
};

const fetchUserQuestions = async ({ reset } = { reset: false }) => {
  if (userQuestionLoading.value || userQuestionLoadingMore.value) return;
  if (!reset && !userQuestionHasMore.value) return;

  if (reset) {
    userQuestionPage.value = 0;
    // 首次拉取前 unknown，避免组件的 IntersectionObserver 过早触发 load-more
    userQuestionHasMore.value = false;
    userQuestionList.value = [];
    userQuestionLoading.value = true;
  } else {
    userQuestionLoadingMore.value = true;
  }

  const page = reset ? 1 : userQuestionPage.value + 1;

  try {
    const data = await fetchUserQuestionList({
      page,
      size: QUESTION_PAGE_SIZE,
      user_id: isOtherProfile.value ? targetUserId.value : undefined,
    });
    if (userQuestionCount.value === null) {
      userQuestionCount.value = Math.max(0, Number(data?.count || 0));
    }
    const results = data?.results || [];
    userQuestionList.value = mergeById(userQuestionList.value, results);
    userQuestionPage.value = page;
    userQuestionHasMore.value = Boolean(data?.next);
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "获取提问列表失败");
  } finally {
    userQuestionLoading.value = false;
    userQuestionLoadingMore.value = false;
  }
};

const ensureUserQuestionsLoaded = () => {
  if (userQuestionLoading.value) return;
  if (userQuestionList.value.length > 0) return;
  fetchUserQuestions({ reset: true });
};

const handleLoadMoreUserQuestions = () => {
  fetchUserQuestions({ reset: false });
};

const fetchFollowQuestions = async ({ reset } = { reset: false }) => {
  if (followQuestionLoading.value || followQuestionLoadingMore.value) return;
  if (!reset && !followQuestionHasMore.value) return;

  if (reset) {
    followQuestionPage.value = 0;
    // 首次拉取前 unknown，避免组件的 IntersectionObserver 过早触发 load-more
    followQuestionHasMore.value = false;
    followQuestionList.value = [];
    followQuestionLoading.value = true;
  } else {
    followQuestionLoadingMore.value = true;
  }

  const page = reset ? 1 : followQuestionPage.value + 1;

  try {
    const data = await fetchFollowingQuestionList({
      page,
      size: FOLLOW_QUESTION_PAGE_SIZE,
      user_id: isOtherProfile.value ? targetUserId.value : undefined,
    });
    const results = data?.results || [];
    followQuestionList.value = mergeById(followQuestionList.value, results);
    followQuestionPage.value = page;
    followQuestionHasMore.value = Boolean(data?.next);
  } catch (error) {
    // 401 由 http 拦截器统一处理，这里不再重复提示/跳转
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "获取关注的问题失败");
  } finally {
    followQuestionLoading.value = false;
    followQuestionLoadingMore.value = false;
  }
};

const ensureFollowQuestionsLoaded = () => {
  if (followQuestionLoading.value) return;
  if (followQuestionList.value.length > 0) return;
  fetchFollowQuestions({ reset: true });
};

const handleLoadMoreFollowQuestions = () => {
  fetchFollowQuestions({ reset: false });
};

const fetchFollowTopics = async ({ reset } = { reset: false }) => {
  if (followTopicLoading.value || followTopicLoadingMore.value) return;
  if (!reset && !followTopicHasMore.value) return;

  if (reset) {
    followTopicPage.value = 0;
    // 首次拉取前 unknown，避免组件的 IntersectionObserver 过早触发 load-more
    followTopicHasMore.value = false;
    followTopicList.value = [];
    followTopicLoading.value = true;
  } else {
    followTopicLoadingMore.value = true;
  }

  const page = reset ? 1 : followTopicPage.value + 1;

  try {
    const data = await fetchFollowingTopics({
      page,
      size: FOLLOW_TOPIC_PAGE_SIZE,
      user_id: isOtherProfile.value ? targetUserId.value : undefined,
    });
    const results = canEditProfile.value
      ? topicFollowStore.applyToList(data?.results || [])
      : data?.results || [];
    followTopicList.value = mergeById(followTopicList.value, results);
    followTopicPage.value = page;
    followTopicHasMore.value = Boolean(data?.next);
    if (reset && canEditProfile.value) topicFollowStore.clearFollowTopicsDirty();
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "获取关注的话题失败");
  } finally {
    followTopicLoading.value = false;
    followTopicLoadingMore.value = false;
  }
};

const ensureFollowTopicsLoaded = () => {
  if (followTopicLoading.value) return;
  if (
    followTopicList.value.length > 0 &&
    (!canEditProfile.value || !topicFollowStore.followTopicsDirty)
  ) {
    return;
  }
  fetchFollowTopics({ reset: true });
};

const handleLoadMoreFollowTopics = () => {
  fetchFollowTopics({ reset: false });
};

const handleToggleFollowTopic = async (topic) => {
  if (!canEditProfile.value) return;
  const id = topic?.id;
  if (!id) return;
  if (followTopicFollowLoadingMap.value[id]) return;

  const isFollowing = Boolean(topic?.is_following);
  const action = isFollowing ? 2 : 1;

  followTopicFollowLoadingMap.value = {
    ...followTopicFollowLoadingMap.value,
    [id]: true,
  };

  try {
    await toggleTopicFollow(id, action);

    const delta = action === 1 ? 1 : -1;
    const nextFollowerCount = Math.max(
      0,
      Number(topic?.follower_count || 0) + delta,
    );

    if (action === 2) {
      topicFollowStore.setTopicState(id, {
        is_following: false,
        follower_count: nextFollowerCount,
      });
      topicFollowStore.markFollowTopicsDirty();

      followTopicList.value = (followTopicList.value || []).filter(
        (t) => t?.id !== id,
      );
      message.success("已取消关注");
      return;
    }

    topic.is_following = true;
    topic.follower_count = nextFollowerCount;
    topicFollowStore.setTopicState(id, {
      is_following: true,
      follower_count: nextFollowerCount,
    });
    topicFollowStore.markFollowTopicsDirty();
    message.success("已关注");
  } catch (error) {
    message.error(error?.message || "操作失败");
  } finally {
    const next = { ...followTopicFollowLoadingMap.value };
    delete next[id];
    followTopicFollowLoadingMap.value = next;
  }
};

const mergeByUserId = (items, incoming) => {
  const map = new Map();
  (items || []).forEach((t) => {
    const id = t?.user?.id;
    if (!id) return;
    map.set(id, t);
  });
  (incoming || []).forEach((t) => {
    const id = t?.user?.id;
    if (!id) return;
    if (!map.has(id)) {
      map.set(id, t);
      return;
    }
    const prev = map.get(id);
    map.set(id, {
      ...prev,
      ...t,
      user: { ...(prev?.user || {}), ...(t?.user || {}) },
    });
  });
  return Array.from(map.values());
};

const fetchFollowUsers = async ({ reset } = { reset: false }) => {
  if (!isOtherProfile.value) return;
  if (followUserLoading.value || followUserLoadingMore.value) return;
  if (!reset && !followUserHasMore.value) return;

  if (reset) {
    followUserPage.value = 0;
    // 首次拉取前 unknown，避免组件的 IntersectionObserver 过早触发 load-more
    followUserHasMore.value = false;
    followUserList.value = [];
    followUserLoading.value = true;
  } else {
    followUserLoadingMore.value = true;
  }

  const page = reset ? 1 : followUserPage.value + 1;

  try {
    const data = await fetchFollowingUsers({
      page,
      size: FOLLOW_USER_PAGE_SIZE,
      user_id: targetUserId.value,
    });
    const results = data?.results || [];
    followUserList.value = mergeByUserId(followUserList.value, results);
    followUserPage.value = page;
    followUserHasMore.value = Boolean(data?.next);
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "获取Ta关注的人失败");
  } finally {
    followUserLoading.value = false;
    followUserLoadingMore.value = false;
  }
};

const ensureFollowUsersLoaded = () => {
  if (!isOtherProfile.value) return;
  if (followUserLoading.value) return;
  if (followUserList.value.length > 0) return;
  fetchFollowUsers({ reset: true });
};

const handleLoadMoreFollowUsers = () => {
  fetchFollowUsers({ reset: false });
};

const tabCount = computed(() => ({
  [PROFILE_TAB.ANSWERS]: answerCount.value,
  [PROFILE_TAB.QUESTIONS]: userQuestionCount.value,
  [PROFILE_TAB.COLLECTIONS]: collectionCount.value,
  // 按你的需求：顶部主 Tab 的“关注”不展示右侧数量
  [PROFILE_TAB.FOLLOWS]: null,
}));

const tabCountLoading = computed(() => ({
  [PROFILE_TAB.ANSWERS]: answerLoading.value && answerCount.value === null,
  [PROFILE_TAB.QUESTIONS]: userQuestionLoading.value && userQuestionCount.value === null,
  [PROFILE_TAB.COLLECTIONS]: collectionLoading.value && collectionCount.value === null,
  [PROFILE_TAB.FOLLOWS]: false,
}));

const followTabList = computed(() => {
  if (canEditProfile.value) return PROFILE_FOLLOW_TAB_LIST;
  return [
    { key: PROFILE_FOLLOW_TAB.QUESTIONS, label: "Ta关注的问题" },
    { key: PROFILE_FOLLOW_TAB.TOPICS, label: "Ta关注的话题" },
    { key: PROFILE_FOLLOW_TAB.USERS_FOLLOWING, label: "Ta关注的人" },
  ];
});

const handleSelectTab = (tab) => {
  activeTab.value = tab;

  if (tab === PROFILE_TAB.ANSWERS) {
    ensureAnswersLoaded();
    return;
  }

  if (tab === PROFILE_TAB.QUESTIONS) {
    ensureUserQuestionsLoaded();
    return;
  }

  if (tab === PROFILE_TAB.FOLLOWS) {
    // 默认进入“我关注的问题”
    activeFollowTab.value = PROFILE_FOLLOW_TAB.QUESTIONS;
    ensureFollowQuestionsLoaded();
  }
};

const handleSelectFollowTab = (tab) => {
  activeFollowTab.value = tab;
  if (tab === PROFILE_FOLLOW_TAB.QUESTIONS) {
    ensureFollowQuestionsLoaded();
    return;
  }
  if (tab === PROFILE_FOLLOW_TAB.TOPICS) {
    ensureFollowTopicsLoaded();
    return;
  }
  if (tab === PROFILE_FOLLOW_TAB.USERS_FOLLOWING) {
    if (isOtherProfile.value) ensureFollowUsersLoaded();
  }
};

watch(
  isOtherProfile,
  (val) => {
    if (!val) return;
    // 他人主页不提供“关注我的人”这一子 Tab
    if (activeFollowTab.value === PROFILE_FOLLOW_TAB.USERS_FOLLOWERS) {
      activeFollowTab.value = PROFILE_FOLLOW_TAB.QUESTIONS;
    }

    // 他人主页不提供编辑态，避免切换用户后残留编辑面板
    if (pageMode.value !== "feed") pageMode.value = "feed";
  },
  { immediate: true },
);

watch(
  [isOtherProfile, () => activeFollowTab.value],
  ([val, tab]) => {
    if (!val) return;
    if (tab === PROFILE_FOLLOW_TAB.USERS_FOLLOWING) ensureFollowUsersLoaded();
  },
  { immediate: true },
);

const handleClickFollowQuestion = (item) => {
  const id = item?.id;
  if (!id) return;
  router.push(`/question/${id}`);
};

const handleClickTopicItem = (topic) => {
  const id = topic?.id;
  if (!id) return;
  router.push(`/topic/${id}`);
};

const handleClickFollowUserItem = (item) => {
  const id = item?.user?.id;
  if (!id) return;
  if (String(id) === String(selfUserId.value || "").trim()) {
    router.push("/profile");
    return;
  }
  router.push(`/user/${id}`);
};

const handleToggleFollowOtherUser = async (entry, action) => {
  const id = entry?.user?.id;
  if (!id) return;
  if (String(id) === String(selfUserId.value || "").trim()) return;
  if (followUserActionLoadingMap.value?.[id]) return;

  setMapFlag(followUserActionLoadingMap, id, true);
  try {
    await toggleUserFollow(id, action);

    // 关注状态以登录用户视角为准，拉一次 /card/ 对齐 is_following / is_mutual
    const next = await fetchUserCard(id);
    followUserList.value = (followUserList.value || []).map((t) =>
      t?.user?.id === id
        ? {
            ...t,
            is_following: Boolean(next?.is_following),
            is_mutual: Boolean(next?.is_mutual),
          }
        : t,
    );

    message.success(Number(action) === 1 ? "已关注" : "已取消关注");
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "操作失败");
  } finally {
    clearMapFlag(followUserActionLoadingMap, id);
  }
};

const handleClickAnswerItem = (item) => {
  const questionId = item?.question?.id;
  if (!questionId) return;
  router.push(`/question/${questionId}`);
};

const setMapFlag = (mapRef, key, value) => {
  mapRef.value = { ...(mapRef.value || {}), [key]: Boolean(value) };
};

const clearMapFlag = (mapRef, key) => {
  const next = { ...(mapRef.value || {}) };
  delete next[key];
  mapRef.value = next;
};

// 个人中心-回答：赞同/取消赞同（不做“踩”）
const handleVoteUserAnswer = async (item) => {
  const answerId = item?.id;
  if (!answerId) return;
  if (answerVoteLoadingMap.value?.[answerId]) return;

  const current = Number(item?.user_vote_status || 0);
  const voteType =
    current === VOTE_STATUS.UPVOTE ? VOTE_STATUS.NONE : VOTE_STATUS.UPVOTE;

  setMapFlag(answerVoteLoadingMap, answerId, true);
  try {
    const patch = await voteAnswer(answerId, voteType);

    // 合并更新：投票接口不返回 collected_count
    if (patch?.upvote_count !== undefined) item.upvote_count = patch.upvote_count;
    if (patch?.comment_count !== undefined) item.comment_count = patch.comment_count;
    if (patch?.user_vote_status !== undefined)
      item.user_vote_status = patch.user_vote_status;
    if (patch?.modified !== undefined) item.modified = patch.modified;
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "投票失败");
  } finally {
    clearMapFlag(answerVoteLoadingMap, answerId);
  }
};

const handleClickUserQuestionItem = (item) => {
  const id = item?.id;
  if (!id) return;
  router.push(`/question/${id}`);
};

// 资料展示/编辑数据：首屏用本地登录态兜底，页面挂载后从接口拉取并覆盖
const profile = ref({
  username: authStore.username || "未登录用户",
  bio: "",
  email: "",
  phone: "",
  avatar: authStore.avatar || "",
  cover_image: "",
});

const applyProfile = (data) => {
  profile.value = {
    ...profile.value,
    id: data?.id || profile.value?.id || "",
    username: data?.username || "",
    email: data?.email ?? "",
    phone: data?.phone ?? "",
    avatar: data?.avatar ?? "",
    cover_image: data?.cover_image ?? "",
    bio: data?.bio ?? "",
    created: data?.created || profile.value?.created || "",
    modified: data?.modified || profile.value?.modified || "",
  };

  // 仅本人主页需要同步 Header 展示（用户名 + 头像）
  if (canEditProfile.value) {
    authStore.updateUserInfo({
      username: profile.value.username,
      avatar: profile.value.avatar,
    });
  }
};

const loadUserProfile = async () => {
  if (profileLoading.value) return;
  profileLoadError.value = "";
  profileLoading.value = true;
  try {
    const data = isOtherProfile.value
      ? await fetchOtherUserProfile(targetUserId.value)
      : await fetchUserProfile();
    applyProfile(data);

    // 草稿仅本人编辑会用到；他人主页也同步一份，便于复用同一套模板但不开放编辑
    draft.value = {
      ...draft.value,
      username: profile.value.username,
      bio: profile.value.bio,
      email: profile.value.email,
      phone: profile.value.phone,
    };
  } catch (error) {
    const msg = error?.message || "获取用户信息失败";
    profileLoadError.value = msg;
    message.error(msg);
  } finally {
    profileLoading.value = false;
  }
};

const loadUserCard = async () => {
  if (!isOtherProfile.value) {
    card.value = null;
    return;
  }
  if (cardLoading.value) return;

  cardLoading.value = true;
  try {
    card.value = await fetchUserCard(targetUserId.value);
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    card.value = null;
  } finally {
    cardLoading.value = false;
  }
};

const isMutual = computed(() => Boolean(card.value?.is_mutual));
const isFollowing = computed(() => Boolean(card.value?.is_following));

const handleToggleFollowUser = async () => {
  if (!isOtherProfile.value) return;
  if (followLoading.value || cardLoading.value) return;

  const uid = String(targetUserId.value || "").trim();
  if (!uid) return;

  followLoading.value = true;
  try {
    const action = isFollowing.value ? 2 : 1;
    await toggleUserFollow(uid, action);
    await loadUserCard();
    message.success(action === 1 ? "已关注" : "已取消关注");
  } catch (error) {
    if (error?.__handled401 || error?.response?.status === 401) return;
    message.error(error?.message || "操作失败");
  } finally {
    followLoading.value = false;
  }
};

const handleMessageUser = () => {
  message.info("私信功能开发中");
};

const applyAchievements = (data) => {
  achievements.value = {
    agree_count: Math.max(0, Number(data?.agree_count || 0)),
    answer_count: Math.max(0, Number(data?.answer_count || 0)),
    follower_count: Math.max(0, Number(data?.follower_count || 0)),
  };
};

const loadUserAchievements = async () => {
  if (achievementLoading.value) return;

  achievementError.value = "";
  achievementLoading.value = true;
  try {
    const data = await fetchUserAchievements({
      user_id: isOtherProfile.value ? targetUserId.value : undefined,
    });
    applyAchievements(data);
  } catch (error) {
    const msg = error?.message || "个人成就加载失败";
    achievementError.value = msg;
    applyAchievements({ agree_count: 0, answer_count: 0, follower_count: 0 });
  } finally {
    achievementLoading.value = false;
  }
};

const mergeCollectionById = (oldList, newList) => {
  const map = new Map();
  (oldList || []).forEach((item) => {
    if (!item?.id) return;
    map.set(item.id, item);
  });
  (newList || []).forEach((item) => {
    if (!item?.id) return;
    map.set(item.id, item);
  });
  return Array.from(map.values());
};

// 收藏夹：进入个人页就加载（自动翻页拉全量）
const loadCollections = async () => {
  if (collectionLoading.value) return;

  collectionError.value = "";
  collectionLoading.value = true;
  try {
    const data = await fetchAllCollections({
      owner: isOtherProfile.value ? targetUserId.value : undefined,
    });
    const results = data?.results || [];

    // 按你的需求：他人主页仅展示公开收藏夹（后端应已过滤，这里再做一次前端兜底）
    const visible = isOtherProfile.value
      ? results.filter((x) => x?.is_public !== false)
      : results;

    collectionCount.value = Math.max(
      0,
      Number(isOtherProfile.value ? visible.length : data?.count || 0),
    );
    collectionList.value = visible;
  } catch (error) {
    const msg = error?.message || "收藏夹加载失败";
    collectionError.value = msg;
    collectionCount.value = 0;
    collectionList.value = [];
  } finally {
    collectionLoading.value = false;
  }
};

const formatCollectionUpdated = (item) => {
  const value = formatDateTimeMinute(item?.modified || item?.created);
  return value ? `更新于 ${value}` : "";
};

const openCreateCollection = () => {
  if (!canEditProfile.value) return;
  createCollectionForm.value = {
    title: "",
    description: "",
    is_public: true,
  };
  createCollectionOpen.value = true;
};

const openEditCollection = (item) => {
  if (!canEditProfile.value) return;
  if (!item?.id) return;
  if (deletingCollectionId.value) return;

  editCollectionId.value = item.id;
  editCollectionOriginal.value = {
    title: String(item.title || ""),
    description: String(item.description || ""),
    is_public: Boolean(item.is_public),
  };
  editCollectionForm.value = {
    title: String(item.title || ""),
    description: String(item.description || ""),
    is_public: Boolean(item.is_public),
  };
  editCollectionOpen.value = true;
};

const handleCreateCollection = async () => {
  if (!canEditProfile.value) return;
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

    collectionCount.value = Number(collectionCount.value || 0) + 1;
    collectionList.value = mergeCollectionById([created], collectionList.value);
    createCollectionOpen.value = false;
    message.success("收藏夹已创建");
  } catch (error) {
    message.error(error?.message || "创建收藏夹失败");
  } finally {
    createCollectionLoading.value = false;
  }
};

const handleUpdateCollection = async () => {
  if (!canEditProfile.value) return;
  if (editCollectionLoading.value) return;
  if (!editCollectionId.value) return;

  const title = String(editCollectionForm.value.title || "").trim();
  if (!title) {
    message.warning("请输入收藏夹标题");
    return;
  }

  const description = String(editCollectionForm.value.description || "").trim();
  const isPublic = Boolean(editCollectionForm.value.is_public);
  const original = editCollectionOriginal.value || {};

  const payload = {};
  if (title !== String(original.title || "")) payload.title = title;
  if (description !== String(original.description || "")) payload.description = description;
  if (isPublic !== Boolean(original.is_public)) payload.is_public = isPublic;

  if (Object.keys(payload).length === 0) {
    message.info("未修改内容");
    return;
  }

  editCollectionLoading.value = true;
  try {
    const updated = await updateCollectionFolder(editCollectionId.value, payload);
    collectionList.value = (collectionList.value || []).map((item) =>
      item?.id === updated?.id ? { ...item, ...updated } : item,
    );
    editCollectionOpen.value = false;
    message.success("收藏夹已更新");
  } catch (error) {
    message.error(error?.message || "修改收藏夹失败");
  } finally {
    editCollectionLoading.value = false;
  }
};

const handleConfirmDeleteCollection = async (item) => {
  if (!canEditProfile.value) return;
  const id = item?.id;
  if (!id) return;
  if (deletingCollectionId.value) return;

  deletingCollectionId.value = id;
  try {
    await deleteCollectionFolder(id);
    collectionList.value = (collectionList.value || []).filter((x) => x?.id !== id);
    if (collectionCount.value !== null) {
      collectionCount.value = Math.max(0, Number(collectionCount.value || 0) - 1);
    }
    message.success("收藏夹已删除");
  } catch (error) {
    message.error(error?.message || "删除收藏夹失败");
  } finally {
    deletingCollectionId.value = null;
  }
};

const handleClickCollection = (item) => {
  if (!item?.id) return;
  if (deletingCollectionId.value) return;
  activeCollection.value = item;
  collectionDetailOpen.value = true;
};

const handleCollectionDetailCountChange = (nextCount) => {
  const id = activeCollection.value?.id;
  if (!id) return;
  const num = Math.max(0, Number(nextCount || 0));

  // activeCollection 通常就是 collectionList 内的引用对象，直接赋值即可同步卡片数量
  if (activeCollection.value) activeCollection.value.answer_count = num;

  // 兜底：若引用不一致，按 id 同步一次
  const hit = (collectionList.value || []).find((x) => x?.id === id);
  if (hit) hit.answer_count = num;
};

const handleRetryCollections = () => {
  loadCollections();
};

// 图片预览：选择后先本地预览，同时立即上传并调用接口保存
const defaultCover = "/default-cover-image.png";
const coverUrl = computed(() => profile.value.cover_image || defaultCover);
const avatarUrl = computed(() => profile.value.avatar || "/default-avatar.png");
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

const coverStyle = computed(() => {
  // 加载中不展示默认封面，避免出现“先默认后真实”的闪一下
  if (profileLoading.value && !profileLoadError.value) return {};
  return { backgroundImage: `url(${effectiveCoverUrl.value})` };
});

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
  if (!canEditProfile.value) return;
  if (avatarUploading.value) return;
  avatarInputRef.value?.click?.();
};

const openCoverPicker = () => {
  if (!canEditProfile.value) return;
  if (coverUploading.value) return;
  coverInputRef.value?.click?.();
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

const preloadImage = (url, timeoutMs = 8000) =>
  new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }

    const img = new Image();
    let done = false;

    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(ok);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  });

const buildCosKey = (dir, username, file) => {
  const name = sanitizeKeyPart(username);
  const ts = Date.now();
  const ext = getFileExt(file);
  return `${dir}/${name}_${ts}.${ext}`;
};

const avatarUploadSeq = ref(0);
const coverUploadSeq = ref(0);

const handleAvatarChange = async (event) => {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) return;

  const seq = (avatarUploadSeq.value += 1);

  revokeUrlSafely(avatarPreviewUrl.value);
  avatarPreviewUrl.value = URL.createObjectURL(file);
  avatarUploading.value = true;

  try {
    const key = buildCosKey(
      "avatar",
      profile.value.username || authStore.username,
      file,
    );
    const res = await uploadToCos(file, key);
    if (seq !== avatarUploadSeq.value) return;

    const data = await patchUserProfile({ avatar: res?.url || "" });
    if (seq !== avatarUploadSeq.value) return;

    applyProfile(data);

    message.success("头像已保存");
    revokeUrlSafely(avatarPreviewUrl.value);
    avatarPreviewUrl.value = "";
  } catch (error) {
    if (seq === avatarUploadSeq.value) {
      message.error(error?.message || "头像上传失败");
      revokeUrlSafely(avatarPreviewUrl.value);
      avatarPreviewUrl.value = "";
    }
  } finally {
    if (seq === avatarUploadSeq.value) avatarUploading.value = false;
    if (input) input.value = "";
  }
};

const handleCoverChange = async (event) => {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) return;

  const seq = (coverUploadSeq.value += 1);

  revokeUrlSafely(coverPreviewUrl.value);
  coverPreviewUrl.value = URL.createObjectURL(file);
  const localPreviewUrl = coverPreviewUrl.value;
  coverUploading.value = true;

  try {
    const key = buildCosKey(
      "cover",
      profile.value.username || authStore.username,
      file,
    );
    const res = await uploadToCos(file, key);
    if (seq !== coverUploadSeq.value) return;

    const data = await patchUserProfile({ cover_image: res?.url || "" });
    if (seq !== coverUploadSeq.value) return;

    applyProfile(data);

    message.success("封面已保存");

    // 等远端封面图加载完成后再切换，避免从 blob 预览切换到远端时出现闪烁
    const remoteUrl = String(data?.cover_image || "").trim();
    const ok = await preloadImage(remoteUrl);
    if (seq !== coverUploadSeq.value) return;
    if (ok && coverPreviewUrl.value === localPreviewUrl) {
      revokeUrlSafely(localPreviewUrl);
      coverPreviewUrl.value = "";
    }
  } catch (error) {
    if (seq === coverUploadSeq.value) {
      message.error(error?.message || "封面上传失败");
      if (coverPreviewUrl.value === localPreviewUrl) {
        revokeUrlSafely(localPreviewUrl);
        coverPreviewUrl.value = "";
      }
    }
  } finally {
    if (seq === coverUploadSeq.value) coverUploading.value = false;
    if (input) input.value = "";
  }
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
  if (!canEditProfile.value) return;
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

const toNullIfBlank = (value) => {
  const str = String(value ?? "").trim();
  return str ? str : null;
};

const saveField = async (field) => {
  if (profileSaving.value) return;

  const payloadValue = toNullIfBlank(draft.value[field]);
  profileSaving.value = true;
  try {
    const data = await patchUserProfile({ [field]: payloadValue });
    applyProfile(data);
    draft.value[field] = profile.value[field];
    message.success("已保存");
    editorOpen.value = false;
  } catch (error) {
    message.error(error?.message || "保存失败");
  } finally {
    profileSaving.value = false;
  }
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

const saveUsername = async () => {
  if (!canEditProfile.value) return;
  if (profileSaving.value) return;

  const username = String(draft.value.username ?? "").trim();
  if (!username) {
    message.warning("用户名不能为空");
    return;
  }

  profileSaving.value = true;
  try {
    const data = await patchUserProfile({ username });
    applyProfile(data);
    draft.value.username = profile.value.username;
    message.success("用户名已保存");
    isEditingUsername.value = false;
  } catch (error) {
    message.error(error?.message || "用户名保存失败");
  } finally {
    profileSaving.value = false;
  }
};

const resetStateForTargetUser = () => {
  // 切换用户时：关闭所有弹窗/抽屉，避免残留在新页面上
  collectionDetailOpen.value = false;
  activeCollection.value = null;
  createCollectionOpen.value = false;
  editCollectionOpen.value = false;

  // 切换用户后回到默认 Tab，避免“带着上一个用户的 Tab 状态”进入新主页造成困惑
  activeTab.value = PROFILE_TAB.ANSWERS;
  activeFollowTab.value = PROFILE_FOLLOW_TAB.QUESTIONS;

  // 他人主页不开放编辑：强制回到 feed
  pageMode.value = "feed";
  editingField.value = null;
  isEditingUsername.value = false;
  editorOpen.value = false;
  pendingFieldToOpen.value = null;

  // 清理本地预览 URL（避免“前一个用户的预览图”短暂残留）
  revokeUrlSafely(avatarPreviewUrl.value);
  revokeUrlSafely(coverPreviewUrl.value);
  avatarPreviewUrl.value = "";
  coverPreviewUrl.value = "";

  // 重置展示用户信息：他人主页不使用登录态兜底，避免闪现“我的昵称/头像”
  profile.value = canEditProfile.value
    ? {
        username: authStore.username || "未登录用户",
        bio: "",
        email: "",
        phone: "",
        avatar: authStore.avatar || "",
        cover_image: "",
      }
    : {
        username: "",
        bio: "",
        email: "",
        phone: "",
        avatar: "",
        cover_image: "",
      };

  profileLoadError.value = "";
  profileLoading.value = false;
  card.value = null;
  cardLoading.value = false;
  followLoading.value = false;

  achievements.value = { agree_count: 0, answer_count: 0, follower_count: 0 };
  achievementError.value = "";
  achievementLoading.value = false;

  collectionCount.value = null;
  collectionList.value = [];
  collectionError.value = "";
  collectionLoading.value = false;

  answerCount.value = null;
  answerList.value = [];
  answerPage.value = 0;
  answerHasMore.value = false;
  answerLoading.value = false;
  answerLoadingMore.value = false;
  answerVoteLoadingMap.value = {};

  userQuestionCount.value = null;
  userQuestionList.value = [];
  userQuestionPage.value = 0;
  userQuestionHasMore.value = false;
  userQuestionLoading.value = false;
  userQuestionLoadingMore.value = false;

  followQuestionList.value = [];
  followQuestionPage.value = 0;
  followQuestionHasMore.value = false;
  followQuestionLoading.value = false;
  followQuestionLoadingMore.value = false;

  followTopicList.value = [];
  followTopicPage.value = 0;
  followTopicHasMore.value = false;
  followTopicLoading.value = false;
  followTopicLoadingMore.value = false;
  followTopicFollowLoadingMap.value = {};

  followUserList.value = [];
  followUserPage.value = 0;
  followUserHasMore.value = false;
  followUserLoading.value = false;
  followUserLoadingMore.value = false;
  followUserActionLoadingMap.value = {};

  draft.value = {
    username: profile.value.username,
    bio: profile.value.bio,
    email: profile.value.email,
    phone: profile.value.phone,
  };
};

const loadForTargetUser = async () => {
  // profile / achievements / collections / card 并行拉取，列表按需加载
  await Promise.all([
    loadUserProfile(),
    loadUserAchievements(),
    loadCollections(),
    loadUserCard(),
  ]);

  // 默认 Tab：回答 + 提问先预加载，保持与“我的主页”一致
  ensureAnswersLoaded();
  ensureUserQuestionsLoaded();

  // 若当前停留在关注 Tab，补齐对应数据
  if (activeTab.value === PROFILE_TAB.FOLLOWS) {
    if (activeFollowTab.value === PROFILE_FOLLOW_TAB.QUESTIONS) {
      ensureFollowQuestionsLoaded();
    } else if (activeFollowTab.value === PROFILE_FOLLOW_TAB.TOPICS) {
      ensureFollowTopicsLoaded();
    } else if (activeFollowTab.value === PROFILE_FOLLOW_TAB.USERS_FOLLOWING) {
      if (isOtherProfile.value) ensureFollowUsersLoaded();
    }
  }
};

watch(
  [() => targetUserId.value, () => isOtherProfile.value],
  () => {
    resetStateForTargetUser();
    loadForTargetUser();
  },
  { immediate: true },
);
</script>

<template>
  <div class="profile-page">
    <AppHeader v-model="headerKeyword" @search="handleHeaderSearch" />

    <section
      class="cover"
      :class="{
        editing: pageMode === 'edit-profile',
        loading: profileLoading && !profileLoadError,
      }"
      :style="coverStyle"
    >
      <div class="cover-mask"></div>
      <div v-if="profileLoading && !profileLoadError" class="cover-skeleton" aria-hidden="true"></div>

      <div v-if="canEditProfile" class="cover-edit">
        <button class="cover-btn" type="button" @click="openCoverPicker">
          <CameraOutlined />
          <span>修改我的封面背景</span>
        </button>
      </div>

      <input
        v-if="canEditProfile"
        ref="coverInputRef"
        class="file-input"
        type="file"
        accept="image/*"
        @change="handleCoverChange"
      />
    </section>

    <div class="container">
      <section class="hero-card">
        <div class="avatar-block" :class="{ readonly: !canEditProfile }" @click="openAvatarPicker">
          <div class="avatar-wrap">
            <img class="avatar" :src="effectiveAvatarUrl" alt="头像" />
            <div
              v-if="canEditProfile"
              class="avatar-overlay"
              :class="{ editing: pageMode === 'edit-profile' }"
            >
              <CameraOutlined />
              <div class="overlay-text">修改我的头像</div>
            </div>
          </div>
          <input
            v-if="canEditProfile"
            ref="avatarInputRef"
            class="file-input"
            type="file"
            accept="image/*"
            @change="handleAvatarChange"
          />
        </div>

        <div class="hero-main">
          <Transition name="fade-slide" mode="out-in">
            <div v-if="pageMode === 'feed'" key="hero-view" class="hero-view">
              <div class="hero-top">
                <div class="hero-title">
                  {{ profile.username }}
                  <span v-if="isOtherProfile && isMutual" class="mutual-badge">
                    <img class="mutual-icon" src="/mutual-follow.svg" alt="互关" />
                    <span>互关</span>
                  </span>
                </div>

                <div class="hero-actions">
                  <button
                    v-if="canEditProfile"
                    class="edit-profile-btn"
                    type="button"
                    @click="enterEditProfile"
                  >
                    编辑个人资料
                  </button>

                  <template v-else>
                    <button
                      class="follow-user-btn"
                      :class="{ following: isFollowing }"
                      type="button"
                      :disabled="followLoading || cardLoading"
                      @click="handleToggleFollowUser"
                    >
                      <UserAddOutlined />
                      <span>
                        <template v-if="followLoading">处理中</template>
                        <template v-else>{{ isFollowing ? "已关注" : "关注Ta" }}</template>
                      </span>
                    </button>

                    <button class="message-user-btn" type="button" @click="handleMessageUser">
                      <MessageOutlined />
                      <span>私信Ta</span>
                    </button>
                  </template>
                </div>
              </div>
              <div v-if="profileLoadError" class="profile-error">
                <a-alert
                  type="warning"
                  show-icon
                  message="用户信息加载失败"
                  :description="profileLoadError"
                />
              </div>
              <div v-if="profileLoading && !profileLoadError" class="hero-sub skeleton-lines" aria-hidden="true">
                <div class="skeleton-line w-70"></div>
                <div class="skeleton-line w-52"></div>
              </div>
              <div v-else class="hero-sub">{{ profile.bio }}</div>
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
                <div class="tabs-left">
                  <button
                    v-for="tab in PROFILE_TAB_LIST"
                    :key="tab.key"
                    class="ptab"
                    :class="{ active: activeTab === tab.key }"
                    type="button"
                    @click="handleSelectTab(tab.key)"
                  >
                    {{ tab.label }}
                    <span
                      v-if="tabCountLoading[tab.key]"
                      class="count-skeleton"
                      aria-hidden="true"
                    ></span>
                    <span v-else-if="tabCount[tab.key] !== null" class="count">{{ tabCount[tab.key] }}</span>
                  </button>
                </div>

                <div class="tabs-right">
                  <button
                    v-if="canEditProfile && activeTab === PROFILE_TAB.COLLECTIONS"
                    class="create-collection-btn"
                    type="button"
                    @click="openCreateCollection"
                  >
                    <PlusOutlined />
                    <span>新建收藏夹</span>
                  </button>
                </div>
              </div>

              <div v-if="activeTab === PROFILE_TAB.FOLLOWS" class="follow-subtabs">
                <button
                  v-for="tab in followTabList"
                  :key="tab.key"
                  class="subtab"
                  :class="{ active: activeFollowTab === tab.key }"
                  type="button"
                  @click="handleSelectFollowTab(tab.key)"
                >
                  {{ tab.label }}
                </button>
              </div>

              <div v-if="activeTab === PROFILE_TAB.ANSWERS">
                <UserAnswerList
                  :answers="answerList"
                  :loading="answerLoading"
                  :loadingMore="answerLoadingMore"
                  :hasMore="answerHasMore"
                  :voteLoadingMap="answerVoteLoadingMap"
                  emptyText="暂无回答"
                  @load-more="handleLoadMoreAnswers"
                  @vote="handleVoteUserAnswer"
                  @item-click="handleClickAnswerItem"
                />
              </div>

              <div v-else-if="activeTab === PROFILE_TAB.QUESTIONS">
                <UserQuestionList
                  :questions="userQuestionList"
                  :loading="userQuestionLoading"
                  :loadingMore="userQuestionLoadingMore"
                  :hasMore="userQuestionHasMore"
                  emptyText="暂无提问"
                  @load-more="handleLoadMoreUserQuestions"
                  @item-click="handleClickUserQuestionItem"
                />
              </div>

              <div v-else-if="activeTab === PROFILE_TAB.COLLECTIONS" class="collection-panel">
                <div v-if="collectionLoading" class="collection-grid" aria-hidden="true">
                  <div v-for="n in 4" :key="n" class="collection-card skeleton-card">
                    <div class="skeleton-line w-70"></div>
                    <div class="skeleton-line w-52"></div>
                    <div class="skeleton-line w-40"></div>
                  </div>
                </div>

                <div v-else-if="collectionError" class="collection-error">
                  <a-empty description="收藏夹加载失败" />
                  <div class="collection-error-text">{{ collectionError }}</div>
                  <a-button type="primary" @click="handleRetryCollections">重试</a-button>
                </div>

                <div v-else class="collection-grid-wrap">
                  <a-empty
                    v-if="collectionList.length === 0"
                    :description="canEditProfile ? '暂无收藏夹' : '暂无公开收藏夹'"
                  />

                  <TransitionGroup v-else tag="div" name="collection-fade" class="collection-grid">
                    <div
                      v-for="item in collectionList"
                      :key="item.id"
                      class="collection-card"
                      role="button"
                      tabindex="0"
                      @click="handleClickCollection(item)"
                    >
                      <div class="collection-top">
                        <div class="collection-title">{{ item.title }}</div>
                        <div class="collection-actions">
                          <div v-if="canEditProfile" class="collection-ops">
                            <button
                              class="collection-action action-edit"
                              type="button"
                              :disabled="deletingCollectionId === item.id"
                              @click.stop="openEditCollection(item)"
                            >
                              <EditOutlined />
                            </button>

                            <a-popconfirm
                              title="确认删除该收藏夹？"
                              ok-text="删除"
                              cancel-text="取消"
                              :disabled="deletingCollectionId === item.id"
                              @confirm="handleConfirmDeleteCollection(item)"
                            >
                              <button
                                class="collection-action action-delete"
                                type="button"
                                :disabled="deletingCollectionId === item.id"
                                @click.stop
                              >
                                <DeleteOutlined />
                              </button>
                            </a-popconfirm>
                          </div>

                          <LockOutlined v-if="item.is_public === false" class="collection-lock" />
                        </div>
                      </div>

                      <div class="collection-desc">
                        {{ item.description || "暂无简介" }}
                      </div>

                      <div class="collection-bottom">
                        <div class="collection-count">{{ item.answer_count || 0 }} 条内容</div>
                        <div class="collection-updated">
                          {{ formatCollectionUpdated(item) }}
                        </div>
                      </div>
                    </div>
                  </TransitionGroup>
                </div>
              </div>

              <div v-else-if="activeTab === PROFILE_TAB.FOLLOWS">
                <template v-if="activeFollowTab === PROFILE_FOLLOW_TAB.QUESTIONS">
                  <FollowQuestionList
                    :questions="followQuestionList"
                    :loading="followQuestionLoading"
                    :loadingMore="followQuestionLoadingMore"
                    :hasMore="followQuestionHasMore"
                    :emptyText="canEditProfile ? '暂无关注的问题' : '暂无Ta关注的问题'"
                    @load-more="handleLoadMoreFollowQuestions"
                    @item-click="handleClickFollowQuestion"
                  />
                </template>

                <template v-else-if="activeFollowTab === PROFILE_FOLLOW_TAB.TOPICS">
                  <TopicList
                    :topics="followTopicList"
                    :loading="followTopicLoading"
                    :loadingMore="followTopicLoadingMore"
                    :hasMore="followTopicHasMore"
                    :followLoadingMap="canEditProfile ? followTopicFollowLoadingMap : {}"
                    :unfollowBehavior="canEditProfile ? 'remove' : 'toggle'"
                    :showFollowButton="canEditProfile"
                    :emptyText="canEditProfile ? '暂无关注的话题' : '暂无Ta关注的话题'"
                    @load-more="handleLoadMoreFollowTopics"
                    @toggle-follow="handleToggleFollowTopic"
                    @item-click="handleClickTopicItem"
                  />
                </template>

                <template
                  v-else-if="activeFollowTab === PROFILE_FOLLOW_TAB.USERS_FOLLOWING && isOtherProfile"
                >
                  <UserFollowList
                    mode="others"
                    :showTime="false"
                    emptyText="暂无Ta关注的人"
                    :items="followUserList"
                    :loading="followUserLoading"
                    :loadingMore="followUserLoadingMore"
                    :hasMore="followUserHasMore"
                    :showAction="true"
                    :selfUserId="selfUserId"
                    :actionLoadingMap="followUserActionLoadingMap"
                    @load-more="handleLoadMoreFollowUsers"
                    @toggle-follow="handleToggleFollowOtherUser"
                    @item-click="handleClickFollowUserItem"
                  />
                </template>

                <template v-else>
                  <ProfileFollowUsersPanel :activeKey="activeFollowTab" />
                </template>
              </div>

              <div v-else class="placeholder">
                <a-empty description="开发中" />
              </div>
            </div>
          </main>

          <aside class="aside">
            <a-card class="side-card" :bordered="false">
              <div class="side-title">个人成就</div>
              <div class="achievements">
                <div v-if="achievementLoading" class="skeleton-lines" aria-hidden="true">
                  <div class="skeleton-line w-70"></div>
                  <div class="skeleton-line w-52"></div>
                  <div class="skeleton-line w-40"></div>
                </div>
                <template v-else>
                  <div class="ach-item">
                    <span class="ach-label">获得</span>
                    <span class="ach-value">{{ achievements.agree_count }}</span>
                    <span class="ach-suffix">次赞同</span>
                  </div>
                  <div class="ach-item">
                    <span class="ach-label">作出</span>
                    <span class="ach-value">{{ achievements.answer_count }}</span>
                    <span class="ach-suffix">次回答</span>
                  </div>
                  <div class="ach-item">
                    <span class="ach-label">得到</span>
                    <span class="ach-value">{{ achievements.follower_count }}</span>
                    <span class="ach-suffix">人关注</span>
                  </div>
                  <div v-if="achievementError" class="ach-error">
                    {{ achievementError }}，已显示为 0
                  </div>
                </template>
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
                          <a-button :loading="profileSaving" type="primary" @click.stop="saveUsername">保存</a-button>
                          <a-button :disabled="profileSaving" @click.stop="cancelUsernameEdit">取消</a-button>
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
                          <a-button :loading="profileSaving" type="primary" @click.stop="saveField('bio')">保存</a-button>
                          <a-button :disabled="profileSaving" @click.stop="cancelFieldEdit('bio')">取消</a-button>
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
                          <a-button :loading="profileSaving" type="primary" @click.stop="saveField('email')">保存</a-button>
                          <a-button :disabled="profileSaving" @click.stop="cancelFieldEdit('email')">取消</a-button>
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
                          <a-button :loading="profileSaving" type="primary" @click.stop="saveField('phone')">保存</a-button>
                          <a-button :disabled="profileSaving" @click.stop="cancelFieldEdit('phone')">取消</a-button>
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

    <CollectionAnswerDrawer
      v-model:open="collectionDetailOpen"
      :collection="activeCollection"
      :readonly="!canEditProfile"
      @count-change="handleCollectionDetailCountChange"
    />

    <template v-if="canEditProfile">
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

      <a-modal
        v-model:open="editCollectionOpen"
        title="编辑收藏夹"
        :confirm-loading="editCollectionLoading"
        ok-text="保存"
        cancel-text="取消"
        @ok="handleUpdateCollection"
      >
        <a-form layout="vertical">
          <a-form-item label="收藏夹标题" required>
            <a-input
              v-model:value="editCollectionForm.title"
              placeholder="请输入收藏夹标题"
              :maxlength="40"
              show-count
            />
          </a-form-item>

          <a-form-item label="收藏夹简介">
            <a-textarea
              v-model:value="editCollectionForm.description"
              placeholder="简单介绍一下这个收藏夹（可选）"
              :rows="3"
              :maxlength="120"
              show-count
            />
          </a-form-item>

          <a-form-item label="是否公开">
            <a-switch v-model:checked="editCollectionForm.is_public" />
            <span class="public-hint">
              {{ editCollectionForm.is_public ? "公开" : "私密" }}
            </span>
          </a-form-item>
        </a-form>
      </a-modal>
    </template>
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

.cover.loading {
  background: linear-gradient(90deg, #eef2f7 0%, #f6f8fb 40%, #eef2f7 80%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
}

.cover-skeleton {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
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

.avatar-block.readonly {
  cursor: default;
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

.profile-error {
  margin-top: 10px;
}

.skeleton-lines {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.skeleton-line {
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 40%, #e5e7eb 80%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
}

.skeleton-line.w-70 {
  width: 70%;
}

.skeleton-line.w-52 {
  width: 52%;
}

.skeleton-line.w-40 {
  width: 40%;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
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

.mutual-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(120, 200, 65, 0.12);
  color: var(--brand-color);
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
  border: 1px solid rgba(120, 200, 65, 0.25);
}

.mutual-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.hero-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.follow-user-btn,
.message-user-btn {
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
  padding: 10px 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease,
    transform 0.12s ease;
}

.follow-user-btn {
  border: 1px solid var(--brand-color);
  background: var(--brand-color);
  color: #fff;
}

.follow-user-btn.following {
  background: #fff;
  color: var(--brand-color);
}

.follow-user-btn:hover {
  border-color: var(--brand-color-dark);
  background: var(--brand-color-dark);
}

.follow-user-btn.following:hover {
  border-color: rgba(120, 200, 65, 0.55);
  background: rgba(120, 200, 65, 0.08);
  color: var(--brand-color);
}

.follow-user-btn:disabled,
.message-user-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.message-user-btn {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #334155;
}

.message-user-btn:hover {
  border-color: rgba(120, 200, 65, 0.45);
  color: var(--brand-color);
  background: rgba(120, 200, 65, 0.06);
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
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
}

.tabs-left {
  display: flex;
  align-items: center;
  gap: 22px;
}

.tabs-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.create-collection-btn {
  border: 1px solid var(--brand-color);
  background: #fff;
  color: var(--brand-color);
  padding: 10px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.create-collection-btn:hover {
  background: var(--brand-color);
  color: #fff;
}

.public-hint {
  margin-left: 10px;
  color: #64748b;
  font-weight: 700;
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

.count-skeleton {
  display: inline-block;
  vertical-align: middle;
  margin-left: 6px;
  width: 18px;
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 40%, #e5e7eb 80%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
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

.collection-panel {
  padding: 18px;
}

.collection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.collection-error {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 18px 0 8px;
}

.collection-error-text {
  color: #94a3b8;
  font-weight: 700;
  font-size: 13px;
  text-align: center;
  max-width: 520px;
}

.collection-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  padding: 14px 16px;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  min-height: 112px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 10px;
}

.collection-card:hover {
  border-color: rgba(120, 200, 65, 0.55);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.12);
  transform: translateY(-2px);
}

.collection-card:hover .collection-title {
  color: var(--brand-color);
}

.collection-card.skeleton-card {
  cursor: default;
  transform: none;
  box-shadow: none;
}

.collection-card.skeleton-card:hover {
  border-color: #e5e7eb;
  box-shadow: none;
  transform: none;
}

.collection-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.collection-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.collection-ops {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  transition: max-width 0.16s ease, opacity 0.16s ease;
}

.collection-card:hover .collection-ops,
.collection-card:focus-within .collection-ops {
  max-width: 80px;
  opacity: 1;
  pointer-events: auto;
}

.collection-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: #94a3b8;
  font-size: 16px;
  line-height: 1;
  transition: color 0.16s ease;
}

.collection-action.action-edit:hover {
  color: var(--brand-color);
}

.collection-action.action-delete:hover {
  color: #ef4444;
}

.collection-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.collection-title {
  font-size: 18px;
  font-weight: 900;
  color: #111827;
  line-height: 1.2;
}

.collection-lock {
  color: #94a3b8;
  font-size: 16px;
}

.collection-desc {
  color: #64748b;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.5;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.collection-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.collection-count {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-weight: 700;
  font-size: 12px;
}

.collection-updated {
  color: #94a3b8;
  font-weight: 700;
  font-size: 12px;
  white-space: nowrap;
}

.collection-fade-enter-active,
.collection-fade-leave-active {
  transition: opacity 0.18s ease;
}

.collection-fade-enter-from,
.collection-fade-leave-to {
  opacity: 0;
}

.placeholder {
  padding: 22px 18px 28px;
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

.ach-error {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 700;
  line-height: 1.4;
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

  .collection-grid {
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
