<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { DownOutlined, UserAddOutlined } from "@ant-design/icons-vue";
import { useRoute, useRouter } from "vue-router";
import AppHeader from "../components/AppHeader.vue";
import QuestionDetailHeader from "../components/QuestionDetailHeader.vue";
import AnswerComposer from "../components/AnswerComposer.vue";
import AnswerFeed from "../components/AnswerFeed.vue";
import AuthorCard from "../components/AuthorCard.vue";
import {
  fetchQuestionDetail,
  toggleQuestionFollow,
  voteQuestion,
} from "../api/question";
import { fetchAnswerList, voteAnswer } from "../api/answer";
import { fetchUserCard, toggleUserFollow } from "../api/user";
import { formatCount } from "../utils/format";
import { VOTE_STATUS } from "../constants/vote";
import { toggleTopicFollow } from "../api/topic";
import { useTopicFollowStore } from "../stores/topicFollow";
import {
  createCollectionFolder,
  fetchAllCollections,
  fetchAllCollectionsContainingAnswer,
  toggleCollectAnswer,
} from "../api/collection";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const topicFollowStore = useTopicFollowStore();

const headerKeyword = ref("");
const handleHeaderSearch = () => {
  message.info("该页面暂不支持搜索，请在首页进行搜索");
};

const APP_HEADER_HEIGHT = 64;

const questionId = computed(() => String(route.params?.id || ""));
const routeAnswerId = computed(() => String(route.query?.answer || "").trim());
const routeCommentId = computed(() => String(route.query?.comment || "").trim());
const routeParentCommentId = computed(() => String(route.query?.parent || "").trim());

const question = ref(null);
const questionLoading = ref(false);
const questionFollowLoading = ref(false);
const questionVoteLoading = ref(false);
const topicFollowLoadingMap = ref({});

const answers = ref([]);
const answerLoading = ref(false);
const answerLoadingMore = ref(false);
const answerHasMore = ref(true);
const answerPage = ref(1);
const ANSWER_PAGE_SIZE = 10;
const answerVoteLoadingMap = ref({});

const firstAnswer = computed(() => answers.value?.[0] || null);

const author = ref(null);
const authorLoading = ref(false);
const authorFollowLoading = ref(false);

// 收藏弹窗：当前回答 id + 收藏夹列表 + 勾选态
const collectModalOpen = ref(false);
const collectModalLoading = ref(false);
const collectConfirmLoading = ref(false);
const collectingAnswerId = ref("");
const collectionsLoading = ref(false);
const collections = ref([]);
// { [answerId]: string[] } - 当前回答已包含该回答的收藏夹 id 列表
const collectedCollectionIdsByAnswerId = ref({});
// 收藏弹窗的“暂存勾选态”：仅点击“完成”后才会提交接口
const collectInitialCollectionIds = ref([]);
const collectDraftCollectionIds = ref([]);

const createCollectionOpen = ref(false);
const createCollectionLoading = ref(false);
const createCollectionForm = ref({
  title: "",
  description: "",
  is_public: true,
});

const stickyTriggerRef = ref(null);
const stickyVisible = ref(false);
let stickyObserver = null;

const showStickyBar = computed(
  () => stickyVisible.value && Boolean(question.value?.title),
);

const composerRef = ref(null);
const answerFeedRef = ref(null);
const hasAnswerDraft = ref(false);
const routeLocateKey = ref("");
const locatingFromRoute = ref(false);

const readAnswerDraftFlag = (qid) => {
  const id = String(qid || "").trim();
  if (!id) return false;
  const key = `huzhi_draft_answer_${id}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return Boolean(String(data?.content || "").trim());
  } catch {
    return false;
  }
};

watch(
  questionId,
  (id) => {
    hasAnswerDraft.value = readAnswerDraftFlag(id);
  },
  { immediate: true },
);

const writeAnswerLabel = computed(() =>
  hasAnswerDraft.value ? "编辑回答" : "写回答",
);

const openComposerAndScroll = () => {
  composerRef.value?.openAndScroll?.();
};

const clearLocateQuery = async () => {
  if (!routeAnswerId.value && !routeCommentId.value && !routeParentCommentId.value) return;

  const nextQuery = { ...(route.query || {}) };
  delete nextQuery.answer;
  delete nextQuery.comment;
  delete nextQuery.parent;
  await router.replace({ path: route.path, query: nextQuery });
};

const handleClickUserProfile = (userId) => {
  const id = String(userId || "").trim();
  if (!id) return;
  if (id === String(authStore.userId || "").trim()) {
    router.push("/profile");
    return;
  }
  router.push(`/user/${id}`);
};

const handleStickyWriteAnswer = () => {
  openComposerAndScroll();
};

const refreshAuthorCard = async (userId) => {
  const uid = String(userId || "").trim();
  if (!uid) return;

  const seq = (userCardSeq += 1);
  authorLoading.value = true;
  try {
    const data = await fetchUserCard(uid);
    if (seq !== userCardSeq) return;
    author.value = data;
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "获取作者信息失败");
  } finally {
    if (seq === userCardSeq) authorLoading.value = false;
  }
};

const handleToggleAuthorFollow = async (userId) => {
  const uid = String(userId || "").trim();
  if (!uid) return;
  if (String(uid) === String(authStore.userId || "").trim()) return;
  if (authorFollowLoading.value) return;

  const isFollowing = Boolean(author.value?.is_following);
  const action = isFollowing ? 2 : 1;

  authorFollowLoading.value = true;
  try {
    await toggleUserFollow(uid, action);
    await refreshAuthorCard(uid);
    message.success(action === 1 ? "已关注" : "已取消关注");
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "操作失败");
  } finally {
    authorFollowLoading.value = false;
  }
};

const observeStickyTrigger = () => {
  if (!stickyTriggerRef.value) return;
  if (stickyObserver) stickyObserver.disconnect();

  stickyObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries?.[0];
      if (!entry) return;
      // trigger 不可见 => 说明已滚过问题头部，显示吸顶栏
      stickyVisible.value = !entry.isIntersecting;
    },
    {
      root: null,
      // 顶部被 AppHeader 占用，缩小可视区域，让切换更贴近“标题滚出 AppHeader 下方”
      rootMargin: `-${APP_HEADER_HEIGHT}px 0px 0px 0px`,
      threshold: 0,
    },
  );

  stickyObserver.observe(stickyTriggerRef.value);
};

watch(questionId, () => {
  // 路由切换时先隐藏，避免短暂闪烁
  stickyVisible.value = false;
});

watch(stickyTriggerRef, () => {
  observeStickyTrigger();
});

onMounted(() => {
  observeStickyTrigger();
});

onBeforeUnmount(() => {
  if (stickyObserver) stickyObserver.disconnect();
  stickyObserver = null;
});

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

const getAnswerById = (answerId) => {
  const id = String(answerId || "").trim();
  if (!id) return null;
  return (
    (answers.value || []).find((item) => String(item?.id || "") === id) || null
  );
};

const collectingAnswer = computed(() => getAnswerById(collectingAnswerId.value));

const setCollectedCollectionIds = (answerId, ids) => {
  collectedCollectionIdsByAnswerId.value = {
    ...collectedCollectionIdsByAnswerId.value,
    [answerId]: ids || [],
  };
};

const isDraftInCollection = (collectionId) =>
  (collectDraftCollectionIds.value || []).includes(collectionId);

const toggleDraftCollection = (collectionId) => {
  if (!collectionId) return;
  const list = collectDraftCollectionIds.value || [];
  const set = new Set(list);
  if (set.has(collectionId)) set.delete(collectionId);
  else set.add(collectionId);
  collectDraftCollectionIds.value = Array.from(set);
};

const setMapFlag = (mapRef, key, value) => {
  mapRef.value = { ...(mapRef.value || {}), [key]: Boolean(value) };
};

const clearMapFlag = (mapRef, key) => {
  const next = { ...(mapRef.value || {}) };
  delete next[key];
  mapRef.value = next;
};

let loadSeq = 0;
const loadQuestionAndAnswers = async (id) => {
  const seq = (loadSeq += 1);
  question.value = null;
  answers.value = [];
  author.value = null;
  answerPage.value = 1;
  answerHasMore.value = true;
  questionFollowLoading.value = false;
  questionVoteLoading.value = false;
  topicFollowLoadingMap.value = {};
  answerVoteLoadingMap.value = {};
  collectModalOpen.value = false;
  collectModalLoading.value = false;
  collectConfirmLoading.value = false;
  collectingAnswerId.value = "";
  collectedCollectionIdsByAnswerId.value = {};
  collectInitialCollectionIds.value = [];
  collectDraftCollectionIds.value = [];

  questionLoading.value = true;
  answerLoading.value = true;

  try {
    const [questionData, answerData] = await Promise.all([
      fetchQuestionDetail(id),
      fetchAnswerList({ question: id, page: 1, size: ANSWER_PAGE_SIZE }),
    ]);

    if (seq !== loadSeq) return;

    question.value = questionData;
    answers.value = answerData?.results || [];
    answerHasMore.value = Boolean(answerData?.next);
    answerPage.value = 1;
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "加载问题详情失败");
  } finally {
    if (seq === loadSeq) {
      questionLoading.value = false;
      answerLoading.value = false;
    }
  }
};

const loadMoreAnswers = async () => {
  if (answerLoading.value || answerLoadingMore.value) return false;
  if (!answerHasMore.value) return false;
  const id = questionId.value;
  if (!id) return false;

  answerLoadingMore.value = true;
  const page = answerPage.value + 1;

  try {
    const data = await fetchAnswerList({
      question: id,
      page,
      size: ANSWER_PAGE_SIZE,
    });
    const results = data?.results || [];
    answers.value = mergeById(answers.value, results);
    answerHasMore.value = Boolean(data?.next);
    answerPage.value = page;
    return true;
  } catch (error) {
    if (error?.__handled401) return false;
    message.error(error?.message || "加载更多回答失败");
    return false;
  } finally {
    answerLoadingMore.value = false;
  }
};

const handleFollowQuestion = async () => {
  const q = question.value;
  const id = q?.id;
  if (!id) return;
  if (questionFollowLoading.value) return;

  const isFollowing = Boolean(q?.is_following);
  const action = isFollowing ? 2 : 1;

  questionFollowLoading.value = true;
  try {
    await toggleQuestionFollow(id, action);

    // 接口不返回更新后的问题对象，因此前端本地维护关注态与关注数
    q.is_following = action === 1;
    const delta = action === 1 ? 1 : -1;
    q.follower_count = Math.max(0, Number(q?.follower_count || 0) + delta);

    message.success(action === 1 ? "已关注问题" : "已取消关注");
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "操作失败");
  } finally {
    questionFollowLoading.value = false;
  }
};

const handleVoteQuestion = async () => {
  const q = question.value;
  const id = q?.id;
  if (!id) return;
  if (questionVoteLoading.value) return;

  const status = Number(q?.user_vote_status || 0);
  const voteType =
    status === VOTE_STATUS.UPVOTE ? VOTE_STATUS.NONE : VOTE_STATUS.UPVOTE;

  questionVoteLoading.value = true;
  try {
    const next = await voteQuestion(id, voteType);
    // 该接口返回完整问题对象，直接以返回值覆盖为准
    question.value = next;
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "投票失败");
  } finally {
    questionVoteLoading.value = false;
  }
};

const handleToggleTopicFollow = async (topic) => {
  const topicId = topic?.id;
  if (!topicId) return;
  if (topicFollowLoadingMap.value?.[topicId]) return;

  const isFollowing = Boolean(topic?.is_following);
  const action = isFollowing ? 2 : 1;
  setMapFlag(topicFollowLoadingMap, topicId, true);

  try {
    await toggleTopicFollow(topicId, action);

    const delta = action === 1 ? 1 : -1;
    topic.is_following = action === 1;
    topic.follower_count = Math.max(
      0,
      Number(topic?.follower_count || 0) + delta,
    );

    // 同步到全局缓存，保持与首页/个人中心的关注状态一致
    topicFollowStore.setTopicState(topicId, {
      is_following: topic.is_following,
      follower_count: topic.follower_count,
    });
    topicFollowStore.markFollowTopicsDirty();

    message.success(action === 1 ? "已关注话题" : "已取消关注");
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "操作失败");
  } finally {
    clearMapFlag(topicFollowLoadingMap, topicId);
  }
};

const handleVoteAnswer = async (answer, clickedVoteType) => {
  const answerId = answer?.id;
  if (!answerId) return;
  if (answerVoteLoadingMap.value?.[answerId]) return;

  const current = Number(answer?.user_vote_status || 0);
  const clicked = Number(clickedVoteType);
  const voteType = current === clicked ? VOTE_STATUS.NONE : clicked;

  setMapFlag(answerVoteLoadingMap, answerId, true);
  try {
    const patch = await voteAnswer(answerId, voteType);
    const target = getAnswerById(answerId);
    if (!target) return;

    // 注意：投票接口返回 is_collected，但不返回 collected_count，避免覆盖本地的 collected_count
    if (patch?.upvote_count !== undefined) target.upvote_count = patch.upvote_count;
    if (patch?.comment_count !== undefined) target.comment_count = patch.comment_count;
    if (patch?.user_vote_status !== undefined)
      target.user_vote_status = patch.user_vote_status;
    if (patch?.modified !== undefined) target.modified = patch.modified;
    if (patch?.is_collected !== undefined) target.is_collected = patch.is_collected;

    // 如果该回答的收藏夹勾选态已缓存，则以缓存推导为准（投票不会改变收藏夹集合）
    const cached = collectedCollectionIdsByAnswerId.value?.[answerId];
    if (Array.isArray(cached)) {
      target.is_collected = cached.length > 0;
    }
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "投票失败");
  } finally {
    clearMapFlag(answerVoteLoadingMap, answerId);
  }
};

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

const loadCollectedCollectionsForAnswer = async (answerId) => {
  if (!answerId) return;
  collectModalLoading.value = true;
  try {
    const data = await fetchAllCollectionsContainingAnswer(answerId, { size: 20 });
    const ids = (data?.results || [])
      .map((x) => x?.id)
      .filter((x) => Boolean(x));
    setCollectedCollectionIds(answerId, ids);
    collectInitialCollectionIds.value = ids;
    collectDraftCollectionIds.value = [...ids];
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "获取收藏状态失败");
  } finally {
    collectModalLoading.value = false;
  }
};

const openCollectModal = async (answer) => {
  const answerId = answer?.id;
  if (!answerId) return;
  collectingAnswerId.value = answerId;
  collectModalOpen.value = true;

  await ensureCollectionsLoaded();
  await loadCollectedCollectionsForAnswer(answerId);
};

const handleCollectModalCancel = () => {
  // 取消：不提交接口，恢复初始勾选态
  collectDraftCollectionIds.value = [...(collectInitialCollectionIds.value || [])];
  collectModalOpen.value = false;
  collectingAnswerId.value = "";
};

const resyncCollectedCollections = async (answerId) => {
  if (!answerId) return [];
  const data = await fetchAllCollectionsContainingAnswer(answerId, { size: 20 });
  const ids = (data?.results || [])
    .map((x) => x?.id)
    .filter((x) => Boolean(x));
  setCollectedCollectionIds(answerId, ids);
  collectInitialCollectionIds.value = ids;
  collectDraftCollectionIds.value = [...ids];
  return ids;
};

const handleCollectModalOk = async () => {
  const answerId = collectingAnswerId.value;
  if (!answerId) {
    collectModalOpen.value = false;
    return;
  }
  if (collectConfirmLoading.value) return;

  const beforeSize = (collectInitialCollectionIds.value || []).length;
  const initialSet = new Set(collectInitialCollectionIds.value || []);
  const draftSet = new Set(collectDraftCollectionIds.value || []);

  // 仅对“勾选态发生变化”的收藏夹调用 toggle 接口
  const changed = new Set();
  for (const id of initialSet) changed.add(id);
  for (const id of draftSet) changed.add(id);
  const diffIds = Array.from(changed).filter(
    (id) => initialSet.has(id) !== draftSet.has(id),
  );

  if (diffIds.length === 0) {
    collectModalOpen.value = false;
    collectingAnswerId.value = "";
    return;
  }

  // 以列表顺序执行（体验更稳定）
  const orderedIds = (collections.value || [])
    .map((c) => c?.id)
    .filter((id) => diffIds.includes(id))
    .concat(diffIds.filter((id) => !(collections.value || []).some((c) => c?.id === id)));

  collectConfirmLoading.value = true;
  try {
    for (const collectionId of orderedIds) {
      const res = await toggleCollectAnswer(collectionId, answerId);

      // 同步收藏夹自身的回答数（接口返回的是该收藏夹内回答数）
      if (res?.answer_count !== undefined) {
        const hit = (collections.value || []).find((c) => c?.id === collectionId);
        if (hit) hit.answer_count = Math.max(0, Number(res.answer_count || 0));
      }
    }

    // 全部提交成功后，将暂存态提交为最终态（以草稿为准）
    const finalIds = Array.from(draftSet);
    setCollectedCollectionIds(answerId, finalIds);

    const target = getAnswerById(answerId);
    if (target) {
      const afterSize = finalIds.length;
      target.is_collected = afterSize > 0;

      // collected_count 为全站去重次数：仅 0<->1 跨越时变更
      if (beforeSize === 0 && afterSize === 1) {
        target.collected_count = Math.max(0, Number(target?.collected_count || 0) + 1);
      } else if (beforeSize === 1 && afterSize === 0) {
        target.collected_count = Math.max(0, Number(target?.collected_count || 0) - 1);
      }
    }

    collectModalOpen.value = false;
    collectingAnswerId.value = "";
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "操作失败，已为你刷新最新收藏状态");

    // 存在“部分成功”的可能：刷新真实状态并同步到列表
    try {
      const latestIds = await resyncCollectedCollections(answerId);
      const target = getAnswerById(answerId);
      if (target) {
        const afterSize = latestIds.length;
        target.is_collected = afterSize > 0;

        if (beforeSize === 0 && afterSize === 1) {
          target.collected_count = Math.max(
            0,
            Number(target?.collected_count || 0) + 1,
          );
        } else if (beforeSize === 1 && afterSize === 0) {
          target.collected_count = Math.max(
            0,
            Number(target?.collected_count || 0) - 1,
          );
        }
      }
    } catch {
      // 忽略二次刷新失败
    }
  } finally {
    collectConfirmLoading.value = false;
  }
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

    // 插入收藏夹列表（置顶）
    collections.value = [created, ...(collections.value || [])];
    createCollectionOpen.value = false;
    message.success("收藏夹已创建");

    // 创建后在弹窗中自动勾选（真正提交在“完成”时）
    if (collectModalOpen.value) {
      const id = created?.id;
      if (id) {
        const set = new Set(collectDraftCollectionIds.value || []);
        set.add(id);
        collectDraftCollectionIds.value = Array.from(set);
      }
    }
  } catch (error) {
    if (error?.__handled401) return;
    message.error(error?.message || "创建收藏夹失败");
  } finally {
    createCollectionLoading.value = false;
  }
};

let userCardSeq = 0;
watch(
  () => firstAnswer.value?.respondent?.id,
  async (userId) => {
    author.value = null;
    if (!userId) return;
    refreshAuthorCard(userId);
  },
  { immediate: true },
);

watch(
  questionId,
  (id) => {
    routeLocateKey.value = "";
    locatingFromRoute.value = false;
    if (!id) return;
    loadQuestionAndAnswers(id);
  },
  { immediate: true },
);

const ensureAnswerLoadedForRoute = async (answerId) => {
  const id = String(answerId || "").trim();
  if (!id) return false;
  if (getAnswerById(id)) return true;

  while (answerHasMore.value) {
    const previousPage = Number(answerPage.value || 1);
    const loaded = await loadMoreAnswers();
    if (getAnswerById(id)) return true;
    if (!loaded) break;
    if (Number(answerPage.value || 1) === previousPage) break;
  }

  return Boolean(getAnswerById(id));
};

const locateTargetFromRoute = async () => {
  const answerId = routeAnswerId.value;
  if (!answerId) return;

  const key = [
    questionId.value,
    answerId,
    routeCommentId.value,
    routeParentCommentId.value,
  ].join("|");

  if (!key) return;
  if (locatingFromRoute.value) return;
  if (routeLocateKey.value === key) return;

  locatingFromRoute.value = true;
  try {
    const answerReady = await ensureAnswerLoadedForRoute(answerId);
    if (!answerReady) {
      message.info("目标回答不存在或暂不可见");
      routeLocateKey.value = key;
      await clearLocateQuery();
      return;
    }

    await nextTick();
    await answerFeedRef.value?.scrollToAnswer?.(answerId, { highlight: true });

    if (routeCommentId.value) {
      const located = await answerFeedRef.value?.locateCommentInAnswer?.(
        answerId,
        routeCommentId.value,
        routeParentCommentId.value,
      );
      if (!located) {
        message.info("目标评论不存在或暂不可见");
      }
    }

    routeLocateKey.value = key;
    await clearLocateQuery();
  } finally {
    locatingFromRoute.value = false;
  }
};

watch(
  () => [
    questionId.value,
    routeAnswerId.value,
    routeCommentId.value,
    routeParentCommentId.value,
    questionLoading.value,
    answerLoading.value,
  ].join("|"),
  async () => {
    if (!questionId.value) return;
    if (!routeAnswerId.value) return;
    if (questionLoading.value || answerLoading.value) return;
    await locateTargetFromRoute();
  },
  { immediate: true },
);

const handleSortClick = () => {
  message.info("排序功能开发中");
};

const handleAnswerSubmitted = (created) => {
  if (!created?.id) return;
  // 新回答插入到列表顶部，便于用户立即看到
  answers.value = [created, ...(answers.value || [])];
  if (question.value) {
    const prev = Number(question.value?.answer_count || 0);
    question.value.answer_count = Math.max(prev + 1, answers.value.length);
  }
};

const handleDraftChange = (val) => {
  hasAnswerDraft.value = Boolean(val);
};

const answerTotalText = computed(() => {
  const total = question.value?.answer_count ?? answers.value?.length ?? 0;
  const num = Math.max(0, Number(total || 0));
  return `${num} 个回答`;
});
</script>

<template>
  <div class="qd-page">
    <AppHeader v-model="headerKeyword" @search="handleHeaderSearch" />

    <div class="qd-sticky" :class="{ show: showStickyBar }">
      <div class="qd-sticky-inner">
        <div class="qd-sticky-title" :title="question?.title || ''">
          {{ question?.title || "" }}
        </div>

        <div class="qd-sticky-actions">
          <button
            class="sticky-btn primary"
            type="button"
            :disabled="!question || questionFollowLoading"
            @click="handleFollowQuestion"
          >
            <UserAddOutlined />
            <span>{{
              question?.is_following ? "已关注问题" : "关注问题"
            }}</span>
          </button>

          <button
            class="sticky-btn outline"
            type="button"
            :disabled="!question"
            @click="handleStickyWriteAnswer"
          >
            {{ writeAnswerLabel }}
          </button>
        </div>
      </div>
    </div>

    <div class="container">
      <QuestionDetailHeader
        :question="question"
        :loading="questionLoading"
        :followLoading="questionFollowLoading"
        :voteLoading="questionVoteLoading"
        :topicFollowLoadingMap="topicFollowLoadingMap"
        :hasDraft="hasAnswerDraft"
        @follow-question="handleFollowQuestion"
        @write-answer="openComposerAndScroll"
        @vote-question="handleVoteQuestion"
        @toggle-topic-follow="handleToggleTopicFollow"
      />

      <div ref="stickyTriggerRef" class="qd-sticky-trigger" aria-hidden="true"></div>

      <section class="answer-grid">
        <div class="left">
          <AnswerComposer
            ref="composerRef"
            :questionId="questionId"
            :scrollOffset="APP_HEADER_HEIGHT + 56"
            @submitted="handleAnswerSubmitted"
            @draft-change="handleDraftChange"
          />

          <div class="answers-head">
            <div class="answers-title">
              {{ answerTotalText }}
            </div>

            <button class="sort-btn" type="button" @click="handleSortClick">
              <span>默认排序</span>
              <DownOutlined class="down" />
            </button>
          </div>

          <div class="answers-body">
            <AnswerFeed
              ref="answerFeedRef"
              :answers="answers"
              :loading="answerLoading"
              :loadingMore="answerLoadingMore"
              :hasMore="answerHasMore"
              :voteLoadingMap="answerVoteLoadingMap"
              :enable-user-link="true"
              emptyText="暂无回答"
              @load-more="loadMoreAnswers"
              @vote="handleVoteAnswer"
              @collect="openCollectModal"
              @user-click="handleClickUserProfile"
            />
          </div>
        </div>

        <aside class="aside">
          <a-card class="side-card" :bordered="false">
            <div class="side-title">关于作者</div>
            <div v-if="firstAnswer" class="side-body">
              <AuthorCard
                v-if="author || authorLoading"
                :user="author"
                :loading="authorLoading"
                :enable-user-link="true"
                :self-user-id="String(authStore.userId || '')"
                :follow-loading="authorFollowLoading"
                @user-click="handleClickUserProfile"
                @follow-toggle="handleToggleAuthorFollow"
              />
              <a-empty v-else description="暂无作者信息" />
            </div>
            <a-empty v-else description="暂无回答" />
          </a-card>

          <a-card
            v-if="firstAnswer"
            class="side-card collected-card"
            :bordered="false"
          >
            <div class="side-title">该回答已被收藏</div>
            <div class="collected">
              <div class="collected-value">
                {{ formatCount(firstAnswer?.collected_count || 0) }}
              </div>
              <div class="collected-unit">次</div>
            </div>
          </a-card>
        </aside>
      </section>
    </div>

    <a-back-top class="huzhi-back-top" :visibilityHeight="300" />

    <a-modal
      v-model:open="collectModalOpen"
      title="收藏到收藏夹"
      ok-text="完成"
      cancel-text="取消"
      :confirm-loading="collectConfirmLoading"
      @ok="handleCollectModalOk"
      @cancel="handleCollectModalCancel"
    >
      <div class="collect-modal">
        <div class="collect-head">
          <div class="collect-tip">
            <div class="collect-title">可多选收藏夹</div>
            <div class="collect-sub">
              <template v-if="collectingAnswer">
                正在收藏：{{ collectingAnswer?.respondent?.username || "匿名用户" }} 的回答
              </template>
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
                    :disabled="
                      collectConfirmLoading ||
                      !collectingAnswerId
                    "
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
    </a-modal>

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

.qd-page {
  min-height: 100vh;
  background: var(--bg);
}

.qd-sticky {
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  z-index: 9;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: saturate(180%) blur(10px);
  border-bottom: 1px solid var(--line);
  transform: translateY(-110%);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.qd-sticky.show {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

.qd-sticky-inner {
  height: 54px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.qd-sticky-title {
  min-width: 0;
  flex: 1;
  font-size: 16px;
  font-weight: 900;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qd-sticky-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
}

.sticky-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 900;
  border: 1px solid transparent;
  background: #fff;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.sticky-btn.primary {
  background: var(--brand-color);
  border-color: var(--brand-color);
  color: #fff;
}

.sticky-btn.primary:hover {
  background: var(--brand-color-dark);
  border-color: var(--brand-color-dark);
}

.sticky-btn.outline {
  border-color: rgba(120, 200, 65, 0.55);
  color: var(--brand-color);
}

.sticky-btn.outline:hover {
  border-color: var(--brand-color);
  background: rgba(120, 200, 65, 0.1);
}

.sticky-btn:disabled {
  cursor: not-allowed;
  opacity: 0.75;
}

.qd-sticky-trigger {
  height: 1px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px 60px;
  min-width: 0;
}

.answer-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
  align-items: start;
}

.left {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.answers-head {
  background: var(--card);
  border-radius: 8px;
  border: 1px solid var(--line);
  overflow: hidden;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.answers-title {
  font-size: 18px;
  font-weight: 900;
  color: #111827;
}

.answers-body {
  background: var(--card);
  border-radius: 8px;
  border: 1px solid var(--line);
  overflow: hidden;
  padding: 0;
}

.sort-btn {
  border: 1px solid rgba(148, 163, 184, 0.32);
  background: #fff;
  color: #64748b;
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.sort-btn:hover {
  border-color: rgba(120, 200, 65, 0.5);
  color: var(--brand-color);
}

.down {
  font-size: 12px;
  color: currentColor;
}

.aside {
  position: sticky;
  top: 82px;
  height: fit-content;
}

:global(.huzhi-back-top .ant-float-btn) {
  width: 44px;
  height: 44px;
}

:global(.huzhi-back-top .ant-float-btn-icon),
:global(.huzhi-back-top .ant-float-btn-content),
:global(.huzhi-back-top .anticon) {
  color: var(--brand-color) !important;
}

:global(.huzhi-back-top svg) {
  fill: var(--brand-color) !important;
}

.side-card {
  border-radius: 8px;
  border: 1px solid var(--line);
}

.side-card + .side-card {
  margin-top: 14px;
}

.side-body {
  padding: 0;
}

.side-title {
  font-size: 15px;
  font-weight: 900;
  color: #111827;
  margin-bottom: 12px;
}

.collected-card .side-title {
  margin-bottom: 10px;
}

.collected {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.collected-value {
  font-size: 30px;
  font-weight: 900;
  color: #111827;
  line-height: 1.1;
}

.collected-unit {
  font-size: 13px;
  font-weight: 800;
  color: #94a3b8;
}

@media (max-width: 1100px) {
  .answer-grid {
    grid-template-columns: 1fr;
  }

  .aside {
    position: static;
  }
}

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
