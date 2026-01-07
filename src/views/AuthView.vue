<script setup>
import { reactive, ref } from "vue";
import { EyeOutlined } from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { login, register } from "../api/auth";

// 封面图路径（同一张图用于背景与左侧图）
const coverImage = "/auth-cover.png";
const footerYear = new Date().getFullYear();

// 登录表单状态
const loginForm = reactive({
  account: "",
  password: "",
  remember: false,
});

// 注册表单状态
const registerForm = reactive({
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
});

const activeTab = ref("login");
const loading = ref(false);
const loginPwdVisible = ref(false);
const registerPwdVisible = ref(false);
const registerConfirmVisible = ref(false);

// 登录提交
const handleLogin = async () => {
  if (!loginForm.account || !loginForm.password) {
    message.warning("请填写账号和密码");
    return;
  }
  loading.value = true;
  try {
    await login({
      account: loginForm.account,
      password: loginForm.password,
    });
    message.success("登录成功");
    // TODO: 登录成功后的跳转或状态处理
  } catch (error) {
    message.error(error?.message || "登录失败");
  } finally {
    loading.value = false;
  }
};

// 注册提交
const handleRegister = async () => {
  if (!registerForm.username || !registerForm.email || !registerForm.password) {
    message.warning("请完整填写注册信息");
    return;
  }
  if (registerForm.password !== registerForm.confirmPassword) {
    message.warning("两次密码不一致");
    return;
  }
  loading.value = true;
  try {
    await register({
      username: registerForm.username,
      email: registerForm.email,
      password: registerForm.password,
    });
    message.success("注册成功");
    activeTab.value = "login";
  } catch (error) {
    message.error(error?.message || "注册失败");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="auth-page">
    <div class="bg-layer" :style="{ backgroundImage: `url(${coverImage})` }"></div>
    <div class="mask"></div>
    <div class="auth-card">
      <div class="panel-left">
        <div class="slogan">
          <h2>发现更大的世界</h2>
          <p>与世界分享你的知识、经验和见解</p>
        </div>
        <div class="cover" :style="{ backgroundImage: `url(${coverImage})` }"></div>
      </div>
      <div class="panel-right">
        <div class="brand">
          <h1>乎知</h1>
          <span>QUESTIONS & ANSWERS</span>
        </div>
        <a-tabs v-model:activeKey="activeTab" class="auth-tabs" centered>
          <a-tab-pane key="login" tab="登录">
            <div class="form-wrap">
              <a-form layout="vertical" @submit.prevent>
                <a-form-item>
                  <a-input v-model:value="loginForm.account" placeholder="用户名或邮箱" size="large" :bordered="false"
                    class="underline-input" />
                </a-form-item>
                <a-form-item>
                  <a-input v-model:value="loginForm.password" :type="loginPwdVisible ? 'text' : 'password'"
                    placeholder="密码" size="large" :bordered="false" class="underline-input">
                    <template #suffix>
                      <span class="pwd-toggle" :class="{ 'is-hidden': !loginPwdVisible }" @mousedown.prevent
                        @click.prevent="loginPwdVisible = !loginPwdVisible">
                        <EyeOutlined />
                      </span>
                    </template>
                  </a-input>
                </a-form-item>
                <div class="row between">
                  <a-checkbox v-model:checked="loginForm.remember">
                    记住我
                  </a-checkbox>
                  <a-button type="link" class="link-plain" tabindex="-1">
                    忘记密码？
                  </a-button>
                </div>
                <a-button block type="primary" size="large" :loading="loading" class="primary-btn" @click="handleLogin">
                  登录
                </a-button>
              </a-form>
            </div>
          </a-tab-pane>
          <a-tab-pane key="register" tab="注册">
            <div class="form-wrap">
              <a-form layout="vertical" @submit.prevent>
                <a-form-item>
                  <a-input v-model:value="registerForm.username" placeholder="用户名" size="large" :bordered="false"
                    class="underline-input" />
                </a-form-item>
                <a-form-item>
                  <a-input v-model:value="registerForm.email" placeholder="邮箱" size="large" :bordered="false"
                    class="underline-input" />
                </a-form-item>
                <a-form-item>
                  <a-input v-model:value="registerForm.password" :type="registerPwdVisible ? 'text' : 'password'"
                    placeholder="密码" size="large" :bordered="false" class="underline-input">
                    <template #suffix>
                      <span class="pwd-toggle" :class="{ 'is-hidden': !registerPwdVisible }" @mousedown.prevent
                        @click.prevent="registerPwdVisible = !registerPwdVisible">
                        <EyeOutlined />
                      </span>
                    </template>
                  </a-input>
                  <div class="field-tip">密码需包含大小写字母和数字，长度至少8位</div>
                </a-form-item>
                <a-form-item>
                  <a-input v-model:value="registerForm.confirmPassword"
                    :type="registerConfirmVisible ? 'text' : 'password'" placeholder="确认密码" size="large"
                    :bordered="false" class="underline-input">
                    <template #suffix>
                      <span class="pwd-toggle" :class="{ 'is-hidden': !registerConfirmVisible }" @mousedown.prevent
                        @click.prevent="registerConfirmVisible = !registerConfirmVisible">
                        <EyeOutlined />
                      </span>
                    </template>
                  </a-input>
                </a-form-item>
                <a-button block type="primary" size="large" :loading="loading" class="primary-btn"
                  @click="handleRegister">
                  注册
                </a-button>
              </a-form>
            </div>
          </a-tab-pane>
        </a-tabs>
        <div class="footer">© {{ footerYear }} 乎知 Huzhi Inc.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:global(:root) {
  --brand-color: #78c841;
  --brand-color-dark: #69b535;
  --text-subtle: #8c9ba5;
  --line-color: #e6e9ef;
}

:global(body) {
  margin: 0;
  background: #f5f7fb;
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  color: #2c3e50;
}

.auth-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.bg-layer {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(8px) saturate(0.8);
  transform: scale(1.05);
}

.mask {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.55);
}

.auth-card {
  position: relative;
  width: 960px;
  max-width: 95%;
  height: 560px;
  max-height: calc(100vh - 48px);
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  z-index: 1;
}

.panel-left {
  background: linear-gradient(160deg, rgba(120, 200, 65, 0.15), #e8f7e3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 32px;
  text-align: center;
}

.slogan h2 {
  margin: 0 0 10px;
  color: var(--brand-color);
  font-size: 28px;
  font-weight: 700;
}

.slogan p {
  margin: 0;
  color: #4a5568;
  font-size: 15px;
}

.cover {
  width: 88%;
  max-width: 420px;
  aspect-ratio: 4 / 3;
  background-size: cover;
  background-position: center;
  border-radius: 12px;
  filter: grayscale(1);
  transition: filter 0.35s ease, transform 0.35s ease;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
}

.cover:hover {
  filter: grayscale(0);
  transform: translateY(-4px);
}

.panel-right {
  padding: 89px 56px 44px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-height: 0;
}

.brand {
  text-align: center;
}

.brand h1 {
  margin: 0;
  color: var(--brand-color);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 1px;
}

.brand span {
  color: var(--text-subtle);
  font-size: 13px;
  letter-spacing: 1.8px;
}

.auth-tabs {
  margin-top: 8px;
}

.auth-tabs :global(.ant-tabs-nav) {
  margin: 0 0 14px 0;
}

.auth-tabs :global(.ant-tabs-nav::before) {
  border-color: var(--line-color);
}

.auth-tabs :global(.ant-tabs-tab) {
  font-size: 18px;
  font-weight: 600;
}

.auth-tabs :global(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: var(--brand-color) !important;
}

.auth-tabs :global(.ant-tabs-ink-bar) {
  background: var(--brand-color);
}

/* 通过压缩表单间距保证注册页不需要内部滚动 */
.auth-tabs :global(.ant-form-item) {
  margin-bottom: 12px;
}

.auth-tabs :global(.ant-form-item:last-child) {
  margin-bottom: 0;
}

.field-tip {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.2;
  color: var(--text-subtle);
}

.form-wrap {
  max-width: 360px;
  margin: 0 auto;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.between {
  justify-content: space-between;
}

.link-plain {
  padding: 0;
  color: var(--text-subtle);
}

.link-plain:hover {
  color: var(--brand-color);
}

:global(.ant-input.underline-input),
:global(.ant-input-affix-wrapper.underline-input) {
  padding-left: 0;
  padding-right: 0;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

:global(.ant-input.underline-input) {
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line-color) !important;
}

:global(.ant-input.underline-input:focus) {
  border-bottom: 1px solid var(--brand-color) !important;
  box-shadow: none !important;
}

:global(.ant-input-affix-wrapper.underline-input) {
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line-color) !important;
}

:global(.ant-input-affix-wrapper-focused.underline-input) {
  border-bottom: 1px solid var(--brand-color) !important;
  box-shadow: none !important;
}

:global(.ant-input-affix-wrapper.underline-input .anticon) {
  color: #a0aec0;
}

.pwd-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: pointer;
  color: #a0aec0;
}

.pwd-toggle:hover {
  color: var(--brand-color);
}

.pwd-toggle.is-hidden::after {
  content: "";
  position: absolute;
  width: 18px;
  height: 2px;
  background: currentColor;
  transform: rotate(-45deg);
  border-radius: 2px;
}

:global(.ant-btn-primary) {
  background: var(--brand-color) !important;
  border-color: var(--brand-color) !important;
}

:global(.ant-btn-primary:hover),
:global(.ant-btn-primary:focus),
:global(.ant-btn-primary:active),
:global(.ant-btn-primary:focus-visible),
:global(.ant-btn-primary:not(:disabled):not(.ant-btn-disabled):active) {
  background: var(--brand-color-dark) !important;
  border-color: var(--brand-color-dark) !important;
}

:global(.ant-checkbox-checked .ant-checkbox-inner) {
  background-color: var(--brand-color) !important;
  border-color: var(--brand-color) !important;
}

:global(.ant-checkbox-inner) {
  border-color: var(--line-color) !important;
}

:global(.ant-checkbox-wrapper:hover .ant-checkbox-inner),
:global(.ant-checkbox-input:focus + .ant-checkbox-inner) {
  border-color: var(--brand-color) !important;
}

:global(.ant-checkbox-checked .ant-checkbox-inner:hover) {
  border-color: var(--brand-color) !important;
}

.footer {
  margin-top: auto;
  color: #a0aec0;
  font-size: 12px;
  text-align: center;
}

@media (max-width: 960px) {
  .auth-card {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 560px;
  }

  .panel-left {
    display: none;
  }
}
</style>
