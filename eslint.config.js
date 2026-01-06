// eslint.config.js
import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import autoImport from './.eslintrc-auto-import.json' with { type: "json" } 

export default [
    // 0. 全局忽略配置
    {
    ignores: [
      "dist/**", // 忽略打包输出目录
      "public/**", // 忽略静态资源目录
      "*.d.ts" // (可选) 忽略类型声明文件
    ]
  },

  // 1. 匹配的文件类型
  {
    files: ["**/*.{js,mjs,cjs,vue}"],
  },

  // 2. 定义全局变量环境 (浏览器 + Node)
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        // 将自动引入的全局变量合并进来
        ...autoImport.globals,
      },
    },
  },

  // 3. JS 推荐规则
  js.configs.recommended,

  // 4. Vue 推荐规则 (选择一个级别)
  // 'flat/essential': 基础规范 (防报错)
  // 'flat/strongly-recommended': 强烈推荐 (包含代码风格)
  // 'flat/recommended': 最严格
  ...pluginVue.configs["flat/essential"],

  // 5. 自定义规则 (可选)
  {
    rules: {
      semi: [0, "always"], // 语句强制分号结尾
      quotes: [0, "double"], // 引号类型 ""
      "no-alert": 0, // 禁止使用alert
      "no-console": 0, // 禁止使用console
      "no-const-assign": 2, // 禁止修改const声明的变量
      "no-debugger": 2, // 禁止使用debugger
      "no-duplicate-case": 2, // switch中的case标签不能重复
      "no-extra-semi": 2, // 禁止多余的冒号
      "no-multi-spaces": 1, // 不能用多余的空格
      "no-unused-vars": 1, //不能出现未使用变量
      "vue/multi-word-component-names": 0, //要求组件名称始终为多字
    },
  },
];
