import { createRouter, createWebHistory } from "vue-router";

// 路由表：先接入登录/注册页，后续模块在此扩展
const routes = [
  { path: "/", redirect: "/auth" },
  {
    path: "/auth",
    name: "auth",
    component: () => import("../views/AuthView.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;

