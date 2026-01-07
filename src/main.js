import { createApp, h } from "vue";
import { ConfigProvider } from "ant-design-vue";
import App from "./App.vue";
import "./assets/global.css";
import router from "./router";

// 全局主题配置：统一组件主色为 #78C841（乎知绿）
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

app.use(router);
app.mount("#app");
