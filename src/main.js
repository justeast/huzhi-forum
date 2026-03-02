import { createApp, h } from "vue";
import { ConfigProvider } from "ant-design-vue";
import { createPinia } from "pinia";
import { config as mdEditorConfig } from "md-editor-v3";
import App from "./App.vue";
import "./assets/global.css";
import "md-editor-v3/lib/style.css";
import "md-editor-v3/lib/preview.css";
import router from "./router";

// Markdown 配置：默认不允许原始 HTML（避免 XSS 风险）
mdEditorConfig({
  markdownItConfig(mdit) {
    mdit.set({
      html: false,
    });
  },
});

// 全局主题配置：统一 Ant Design Vue 的主题色为 #78C841（乎知绿）
const theme = {
  token: {
    colorPrimary: "#78C841",
    colorPrimaryHover: "#69b535",
    colorPrimaryActive: "#5aa62b",
  },
};

const app = createApp({
  render: () => h(ConfigProvider, { theme }, { default: () => h(App) }),
});

app.use(createPinia());
app.use(router);
app.mount("#app");
