<template>
  <router-view />
  <ChatDrawer />
  <NotificationDrawer />
</template>

<script setup>
import ChatDrawer from "./components/ChatDrawer.vue";
import NotificationDrawer from "./components/NotificationDrawer.vue";
</script>
