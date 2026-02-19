<script setup>
import { computed, ref } from "vue";
import { message } from "ant-design-vue";
import {
  LikeFilled,
  PlusOutlined,
  UserAddOutlined,
} from "@ant-design/icons-vue";
import { formatCount } from "../utils/format";

const props = defineProps({
  question: { type: Object, default: null },
  loading: { type: Boolean, default: false },
});

const activeTopicId = ref(null);
let closeTimer = null;

const topics = computed(() => props.question?.topics || []);

const handleWriteAnswer = () => {
  message.info("写回答功能开发中");
};

const handleFollowQuestion = () => {
  message.info("关注问题功能开发中");
};

const handleInviteAnswer = () => {
  message.info("邀请回答功能开发中");
};

const handleQuestionUpvote = () => {
  message.info("好问题功能开发中");
};

const handleToggleTopicFollow = () => {
  message.info("关注话题功能开发中");
};

const handleTopicEnter = (id) => {
  // 进入话题 chip / 卡片区域时取消延迟关闭，避免“移到按钮卡片就消失”的体验问题
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  activeTopicId.value = id;
};

const handleTopicLeave = (id) => {
  // 给一点延迟：允许用户从 chip 移动到卡片内部按钮（卡片是绝对定位，可能不在父元素盒模型内）
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (activeTopicId.value === id) activeTopicId.value = null;
    closeTimer = null;
  }, 140);
};

const getTopicIcon = (topic) => topic?.icon || "/default-topic.svg";

const handleTopicIconError = (event) => {
  const el = event?.target;
  if (!el || el.dataset?.fallbackApplied) return;
  el.dataset.fallbackApplied = "1";
  el.src = "/default-topic.svg";
};

const formatTopicStat = (value) => formatCount(value || 0);
</script>

<template>
  <section class="q-header">
    <a-spin :spinning="loading">
      <div v-if="question" class="q-card">
        <div class="q-main">
          <div v-if="topics.length > 0" class="topic-row">
            <div
              v-for="t in topics"
              :key="t.id"
              class="topic-wrap"
              @mouseenter="handleTopicEnter(t.id)"
              @mouseleave="handleTopicLeave(t.id)"
            >
              <span class="topic-chip">{{ t.name }}</span>

              <div
                class="topic-pop"
                :class="{ show: activeTopicId === t.id }"
                @mouseenter="handleTopicEnter(t.id)"
                @mouseleave="handleTopicLeave(t.id)"
              >
                <div class="topic-pop-inner">
                  <div class="topic-pop-head">
                    <div class="topic-pop-icon">
                      <img
                        :src="getTopicIcon(t)"
                        :alt="t.name || '话题图标'"
                        @error="handleTopicIconError"
                      />
                    </div>
                    <div class="topic-pop-title">
                      <div class="topic-name">{{ t.name }}</div>
                      <div class="topic-intro">
                        {{ t.introduction || "暂无简介" }}
                      </div>
                    </div>
                  </div>

                  <div class="topic-pop-foot">
                    <div class="foot-right">
                      <div class="stat-block">
                        <span class="num">{{
                          formatTopicStat(t.question_count)
                        }}</span>
                        <span class="txt">个问题</span>
                      </div>

                      <div class="stat-block">
                        <span class="num">{{
                          formatTopicStat(t.follower_count)
                        }}</span>
                        <span class="txt">人关注</span>
                      </div>

                      <button
                        class="topic-follow"
                        type="button"
                        @click.stop="handleToggleTopicFollow"
                      >
                        <template v-if="t.is_following">已关注</template>
                        <template v-else>+ 关注</template>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h1 class="q-title">{{ question.title }}</h1>
          <div class="q-content">{{ question.content }}</div>

          <div class="q-actions">
            <button class="btn primary" type="button" @click="handleWriteAnswer">
              写回答
            </button>
            <button class="btn outline" type="button" @click="handleFollowQuestion">
              <UserAddOutlined />
              <span>{{ question.is_following ? "已关注问题" : "关注问题" }}</span>
            </button>
            <button class="btn ghost" type="button" @click="handleInviteAnswer">
              <PlusOutlined />
              <span>邀请回答</span>
            </button>

            <button class="btn like" type="button" @click="handleQuestionUpvote">
              <LikeFilled />
              <span>好问题 {{ formatCount(question.upvote_count || 0) }}</span>
            </button>
          </div>
        </div>

        <aside class="q-stats">
          <div class="stat-item">
            <div class="label">关注者</div>
            <div class="value">{{ formatCount(question.follower_count || 0) }}</div>
          </div>
          <div class="stat-item">
            <div class="label">被浏览</div>
            <div class="value">{{ formatCount(question.view_count || 0) }}</div>
          </div>
        </aside>
      </div>
    </a-spin>
  </section>
</template>

<style scoped>
.q-header {
  margin-top: 18px;
}

.q-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 280px;
}

.q-main {
  padding: 18px 18px 16px;
  min-width: 0;
}

.topic-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.topic-wrap {
  position: relative;
}

.topic-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(120, 200, 65, 0.12);
  border: 1px solid rgba(120, 200, 65, 0.2);
  color: var(--brand-color);
  font-weight: 900;
  font-size: 12px;
  cursor: default;
}

.topic-pop {
  position: absolute;
  left: 0;
  top: 40px;
  width: 280px;
  z-index: 20;
  opacity: 0;
  transform: translateY(6px);
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.topic-pop.show {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.topic-pop-inner {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14);
  padding: 14px;
}

.topic-pop-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.topic-pop-icon {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  background: #f8fafc;
  overflow: hidden;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.topic-pop-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.topic-pop-title {
  min-width: 0;
  flex: 1;
}

.topic-name {
  font-weight: 900;
  font-size: 15px;
  color: #111827;
  line-height: 1.2;
}

.topic-intro {
  margin-top: 6px;
  color: #64748b;
  font-weight: 700;
  font-size: 12px;
  line-height: 1.5;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.topic-pop-foot {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
}

.foot-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: none;
  flex-wrap: nowrap;
}

.topic-pop-stats {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat-block {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}

.num {
  color: #64748b;
  font-weight: 900;
}

.topic-follow {
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid var(--brand-color);
  background: var(--brand-color);
  color: #fff;
  font-weight: 900;
  font-size: 12px;
  cursor: pointer;
  flex: none;
  transition: background 0.18s ease, color 0.18s ease;
}

.topic-follow:hover {
  background: var(--brand-color-dark);
  border-color: var(--brand-color-dark);
}

.q-title {
  margin: 0;
  font-size: 34px;
  font-weight: 900;
  color: #111827;
  line-height: 1.2;
}

.q-content {
  margin-top: 12px;
  color: #334155;
  line-height: 1.9;
  font-size: 14px;
  white-space: pre-wrap;
}

.q-actions {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.btn {
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 900;
  border: 1px solid transparent;
  background: #fff;
  display: inline-flex;
  align-items: center;
  gap: 8px;
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

.btn.outline {
  border-color: rgba(120, 200, 65, 0.55);
  color: var(--brand-color);
}

.btn.outline:hover {
  border-color: var(--brand-color);
  background: rgba(120, 200, 65, 0.1);
}

.btn.ghost {
  border-color: transparent;
  color: #334155;
  background: transparent;
}

.btn.ghost:hover {
  color: var(--brand-color);
}

.btn.like {
  border-color: transparent;
  background: transparent;
  color: #64748b;
  margin-left: auto;
}

.btn.like:hover {
  color: var(--brand-color);
}

.q-stats {
  padding: 18px 18px 16px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  align-content: center;
  position: relative;
}

.q-stats::before {
  content: "";
  position: absolute;
  left: 0;
  top: 14px;
  bottom: 14px;
  width: 1px;
  background: var(--line);
}

.stat-item {
  padding: 6px 10px;
  text-align: center;
}

.stat-item .label {
  color: #94a3b8;
  font-weight: 800;
  font-size: 13px;
}

.stat-item .value {
  margin-top: 6px;
  font-size: 26px;
  font-weight: 900;
  color: #111827;
}

@media (max-width: 1100px) {
  .q-card {
    grid-template-columns: 1fr;
  }

  .q-stats {
    border-top: 1px solid var(--line);
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .q-stats::before {
    display: none;
  }

  .btn.like {
    margin-left: 0;
  }
}
</style>
