<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { DownOutlined, UpOutlined } from "@ant-design/icons-vue";
import { MdPreview } from "md-editor-v3";

const props = defineProps({
  content: { type: String, default: "" },
  collapsedHeight: { type: Number, default: 180 },
  expandText: { type: String, default: "显示全部" },
  collapseText: { type: String, default: "收起" },
  defaultCollapsed: { type: Boolean, default: true },
  hideImagesWhenCollapsed: { type: Boolean, default: true },
  // 受控展开态：用于父组件在外部同步展开/收起状态
  expanded: { type: Boolean, default: undefined },
  // 展开后是否展示底部固定收起栏
  stickyWhenExpanded: { type: Boolean, default: true },
});

const emit = defineEmits(["update:expanded"]);

const innerExpanded = ref(!props.defaultCollapsed);
const rootRef = ref(null);
const bodyRef = ref(null);
const endRef = ref(null);
let rafId = null;
let ioRoot = null;
let ioEnd = null;

const stickyRect = ref({ left: 0, width: 0 });
const rootInView = ref(true);
const endInView = ref(false);

const normalizedContent = computed(() => String(props.content || ""));

const isExpanded = computed(() =>
  typeof props.expanded === "boolean" ? props.expanded : innerExpanded.value,
);

const hasImages = computed(() =>
  /!\[[^\]]*]\([^)\s]+[^)]*\)/.test(normalizedContent.value),
);

const imageCount = computed(() => {
  const matches = normalizedContent.value.match(/!\[[^\]]*]\([^)\s]+[^)]*\)/g);
  return matches?.length || 0;
});

const textLineCount = computed(() =>
  normalizedContent.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length,
);

const plainTextLength = computed(() =>
  normalizedContent.value
    .replace(/!\[[^\]]*]\([^)\s]+[^)]*\)/g, "")
    .replace(/[`>#*\-_[\]()]/g, "")
    .trim().length,
);

const shouldShowToggle = computed(
  () => hasImages.value || textLineCount.value > 5 || plainTextLength.value > 180,
);

const isCollapsed = computed(
  () => shouldShowToggle.value && !isExpanded.value && props.defaultCollapsed,
);

const shouldShowStickyBar = computed(
  () =>
    props.stickyWhenExpanded &&
    props.defaultCollapsed &&
    shouldShowToggle.value &&
    isExpanded.value,
);

const showFixedBar = computed(
  () => shouldShowStickyBar.value && rootInView.value && !endInView.value,
);

const showEndBar = computed(
  () => shouldShowStickyBar.value && rootInView.value && endInView.value,
);

const stickyBarStyle = computed(() => {
  const left = Number(stickyRect.value?.left || 0);
  const width = Number(stickyRect.value?.width || 0);
  if (!width) {
    return { left: "0px", width: "100%" };
  }
  return {
    left: `${left}px`,
    width: `${width}px`,
  };
});

const bodyStyle = computed(() => {
  if (!isCollapsed.value) return {};
  return {
    maxHeight: `${props.collapsedHeight}px`,
    overflow: "hidden",
  };
});

const disconnectStickyObservers = () => {
  if (ioRoot) ioRoot.disconnect();
  ioRoot = null;
  if (ioEnd) ioEnd.disconnect();
  ioEnd = null;
  rootInView.value = true;
  endInView.value = false;
};

const updateStickyRect = () => {
  const el = rootRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth || 0;
  const pad = 12;
  let left = rect.left;
  let width = rect.width;

  if (!vw) return;
  width = Math.min(width, Math.max(0, vw - pad * 2));
  left = Math.max(pad, Math.min(left, vw - pad - width));
  stickyRect.value = { left, width };
};

const scheduleStickyUpdate = async () => {
  if (!shouldShowStickyBar.value) return;
  await nextTick();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    updateStickyRect();
    rafId = null;
  });
};

const handleWindowResize = () => {
  if (!shouldShowStickyBar.value) return;
  scheduleStickyUpdate();
};

const ensureStickyObservers = () => {
  if (!shouldShowStickyBar.value) return;
  if (typeof IntersectionObserver === "undefined") return;
  if (!rootRef.value || !endRef.value) return;
  if (ioRoot || ioEnd) return;

  ioRoot = new IntersectionObserver(
    (entries) => {
      rootInView.value = Boolean(entries?.[0]?.isIntersecting);
    },
    { root: null, threshold: 0 },
  );
  ioRoot.observe(rootRef.value);

  ioEnd = new IntersectionObserver(
    (entries) => {
      endInView.value = Boolean(entries?.[0]?.isIntersecting);
    },
    { root: null, threshold: 0 },
  );
  ioEnd.observe(endRef.value);
};

const syncStickyState = async () => {
  if (!shouldShowStickyBar.value) {
    window.removeEventListener("resize", handleWindowResize);
    disconnectStickyObservers();
    return;
  }
  window.addEventListener("resize", handleWindowResize);
  ensureStickyObservers();
  await scheduleStickyUpdate();
};

const toggle = async () => {
  if (!shouldShowToggle.value) return;
  const next = !isExpanded.value;
  if (typeof props.expanded === "boolean") {
    emit("update:expanded", next);
  } else {
    innerExpanded.value = next;
    emit("update:expanded", next);
  }
  await syncStickyState();
};

watch(
  () => props.content,
  () => {
    if (typeof props.expanded !== "boolean") {
      innerExpanded.value = !props.defaultCollapsed;
    }
  },
  { immediate: true },
);

watch(
  shouldShowStickyBar,
  async () => {
    await syncStickyState();
  },
  { immediate: true, flush: "post" },
);

onMounted(async () => {
  await syncStickyState();
});

onBeforeUnmount(() => {
  disconnectStickyObservers();
  window.removeEventListener("resize", handleWindowResize);
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
});
</script>

<template>
  <div
    ref="rootRef"
    class="md-collapse"
    :class="{
      collapsed: isCollapsed,
      'hide-img': isCollapsed && hideImagesWhenCollapsed,
      'has-fixed': showFixedBar,
    }"
  >
    <div ref="bodyRef" class="md-body" :style="bodyStyle">
      <MdPreview :modelValue="normalizedContent" :noHighlight="true" />
      <div ref="endRef" class="end-sentinel" aria-hidden="true"></div>
    </div>

    <!-- 折叠态：显示渐变遮罩 + 展开按钮；并提示“[图片]” -->
    <div
      v-if="shouldShowToggle && !isExpanded"
      class="toggle-row"
      :class="{ over: isCollapsed }"
      @click.stop
    >
      <div v-if="isCollapsed" class="mask" aria-hidden="true"></div>

      <span v-if="isCollapsed && hasImages" class="img-hint">
        [图片<span v-if="imageCount > 1">×{{ imageCount }}</span>]
      </span>

      <button class="toggle-btn" type="button" @click.stop="toggle">
        <span>{{ isExpanded ? collapseText : expandText }}</span>
        <UpOutlined v-if="isExpanded" class="icon" />
        <DownOutlined v-else class="icon" />
      </button>
    </div>

    <!-- 已读到末尾：显示“就地的操作+收起”，避免固定栏在底部造成混淆 -->
    <div v-if="showEndBar" class="end-bar" @click.stop>
      <div class="end-actions">
        <slot name="actions" />
      </div>

      <button class="end-collapse" type="button" @click.stop="toggle">
        <span>{{ collapseText }}</span>
        <UpOutlined class="icon" />
      </button>
    </div>

    <!-- 展开态：sticky 操作/收起栏（默认只包含“收起”，父组件可通过 slot 注入操作按钮） -->
    <div
      v-if="showFixedBar"
      class="sticky-bar show"
      :style="stickyBarStyle"
      @click.stop
    >
      <div class="sticky-actions">
        <slot name="actions" />
      </div>

      <button class="sticky-collapse" type="button" @click.stop="toggle">
        <span>{{ collapseText }}</span>
        <UpOutlined class="icon" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.md-collapse {
  position: relative;
}

.md-collapse :deep(.md-editor-preview-wrapper) {
  padding: 0;
  background: transparent;
}

.md-collapse :deep(.md-editor-preview) {
  color: inherit;
  font-size: inherit;
  line-height: inherit;
}

.md-collapse :deep(p) {
  margin: 0 0 8px;
}

.md-collapse :deep(ul),
.md-collapse :deep(ol) {
  margin: 0 0 8px;
  padding-left: 18px;
}

.md-collapse :deep(img) {
  max-width: 100%;
  height: auto;
}

.md-collapse :deep(a) {
  color: var(--brand-color);
}

.md-collapse.has-fixed .md-body {
  /* 避免内容被 sticky bar 遮挡 */
  padding-bottom: 52px;
}

.toggle-row {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.toggle-row.over {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 0 2px;
  justify-content: flex-end;
}

.mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 56px;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0),
    rgba(255, 255, 255, 1)
  );
  pointer-events: none;
}

.img-hint {
  position: relative;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 800;
}

.toggle-btn {
  position: relative;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.toggle-btn:hover {
  color: var(--brand-color);
}

.icon {
  font-size: 12px;
}

.md-collapse.collapsed :deep(.md-editor-preview-wrapper) {
  padding-bottom: 24px;
}

.md-collapse.hide-img :deep(img) {
  display: none;
}

.end-sentinel {
  width: 100%;
  height: 1px;
}

.end-bar {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #94a3b8;
  font-size: 13px;
}

.end-actions {
  min-width: 0;
  flex: 1;
}

.end-collapse {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: #64748b;
  font-size: 13px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.end-collapse:hover {
  color: var(--brand-color);
}

.sticky-bar {
  position: fixed;
  bottom: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0 8px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-top: 1px solid #f0f2f5;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.sticky-bar.show {
  opacity: 1;
  transform: translateY(0);
}

.sticky-actions {
  min-width: 0;
  flex: 1;
}

.sticky-collapse {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: #64748b;
  font-size: 13px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.sticky-collapse:hover {
  color: var(--brand-color);
}
</style>
