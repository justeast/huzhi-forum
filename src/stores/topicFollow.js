import { defineStore } from "pinia";

// 话题关注状态同步：跨 Tab 共享一份关注状态，避免刷新前出现 UI 不一致
export const useTopicFollowStore = defineStore("topicFollow", {
  state: () => ({
    // { [topicId]: { is_following: boolean, follower_count: number } }
    byId: {},
    // 话题 Tab 发生关注/取消关注后，标记“关注的话题”需要刷新
    followTopicsDirty: false,
  }),
  actions: {
    setTopicState(topicId, { is_following, follower_count }) {
      if (!topicId) return;
      this.byId[topicId] = {
        is_following: Boolean(is_following),
        follower_count: Math.max(0, Number(follower_count || 0)),
      };
    },
    applyToTopic(topic) {
      const id = topic?.id;
      if (!id) return topic;
      const cached = this.byId[id];
      if (!cached) return topic;
      return {
        ...topic,
        is_following: cached.is_following,
        follower_count: cached.follower_count,
      };
    },
    applyToList(list) {
      return (list || []).map((t) => this.applyToTopic(t));
    },
    markFollowTopicsDirty() {
      this.followTopicsDirty = true;
    },
    clearFollowTopicsDirty() {
      this.followTopicsDirty = false;
    },
  },
});

