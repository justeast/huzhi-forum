import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

// 路由表：先接入登录/注册页，后续模块在此扩展
const routes = [
  { path: "/", redirect: "/auth" },
  {
    path: "/auth",
    name: "auth",
    component: () => import("../views/AuthView.vue"),
  },
  {
    path: "/home",
    name: "home",
    component: () => import("../views/HomeView.vue"),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 简单路由守卫：未登录跳转到登录页；已登录访问 /auth 自动跳转首页
router.beforeEach((to) => {
  const authStore = useAuthStore();

  if (to.name === "auth" && authStore.isLoggedIn) {
    return { name: "home" };
  }

  if (to.meta?.requiresAuth && !authStore.isLoggedIn) {
    return { name: "auth", query: { redirect: to.fullPath } };
  }

  return true;
});

export default router;
