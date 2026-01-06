import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 引入自动导入插件
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { AntDesignVueResolver } from "unplugin-vue-components/resolvers";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),

    // 自动导入 Vue API (ref, reactive, computed 等)
    AutoImport({
      imports: ["vue", "vue-router", "pinia"],
      // 自动导入 Antd 的 message, notification 等工具函数
      resolvers: [AntDesignVueResolver()],
      // 生成.eslintrc-auto-import.json文件
      eslintrc: {
        enabled: true,
        filepath: "./.eslintrc-auto-import.json",
        globalsPropValue: true,
      },
      dts: false, // JS项目不需要生成 .d.ts
    }),

    // 自动导入 Antd 组件 (Button, Table, Input 等)
    Components({
      resolvers: [
        AntDesignVueResolver({
          importStyle: false, // Antdv 4.x 使用 CSS-in-JS，通常不需要手动处理样式文件
        }),
      ],
      dts: false,
    }),
  ],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
