// 动态高度展开/收起过渡：避免固定 max-height 带来的回弹抖动
export const useExpandTransition = () => {
  const beforeEnter = (el) => {
    el.style.boxSizing = "border-box";
    el.style.willChange = "height, opacity, transform";
    el.style.height = "0";
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
    el.style.overflow = "hidden";
  };

  const enter = (el) => {
    const height = el.scrollHeight;
    // 触发一次 reflow，确保过渡生效
    void el.offsetHeight;
    el.style.transition =
      "height 0.24s ease, opacity 0.18s ease, transform 0.18s ease";
    el.style.height = `${height}px`;
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  };

  const afterEnter = (el) => {
    el.style.boxSizing = "";
    el.style.willChange = "";
    el.style.height = "";
    el.style.opacity = "";
    el.style.transform = "";
    el.style.overflow = "";
    el.style.transition = "";
  };

  const beforeLeave = (el) => {
    el.style.boxSizing = "border-box";
    el.style.willChange = "height, opacity, transform";
    // 离开时固定为当前可见高度，避免用 scrollHeight 导致先“撑大”再收起的回弹
    const { height } = el.getBoundingClientRect();
    el.style.height = `${height}px`;
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
    el.style.overflow = "hidden";
  };

  const leave = (el) => {
    void el.offsetHeight;
    el.style.transition =
      "height 0.24s ease, opacity 0.18s ease, transform 0.18s ease";
    el.style.height = "0";
    el.style.opacity = "0";
    el.style.transform = "translateY(-6px)";
  };

  const afterLeave = (el) => {
    el.style.boxSizing = "";
    el.style.willChange = "";
    el.style.height = "";
    el.style.opacity = "";
    el.style.transform = "";
    el.style.overflow = "";
    el.style.transition = "";
  };

  return {
    beforeEnter,
    enter,
    afterEnter,
    beforeLeave,
    leave,
    afterLeave,
  };
};

