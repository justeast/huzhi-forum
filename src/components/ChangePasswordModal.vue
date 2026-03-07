<script setup>
import { computed, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { EyeOutlined, LockOutlined } from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { useAuthStore } from "../stores/auth";
import { changePassword } from "../api/user";

const props = defineProps({
  open: { type: Boolean, default: false },
});

const emit = defineEmits(["update:open"]);

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const oldPwdVisible = ref(false);
const newPwdVisible = ref(false);
const confirmVisible = ref(false);

const submitting = ref(false);

// 密码需包含大小写字母和数字，长度至少8位
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const canSubmit = computed(() => {
  if (submitting.value) return false;
  if (!String(form.oldPassword || "").trim()) return false;
  if (!String(form.newPassword || "").trim()) return false;
  if (!String(form.confirmPassword || "").trim()) return false;
  return true;
});

const close = () => {
  if (submitting.value) return;
  emit("update:open", false);
};

const reset = () => {
  form.oldPassword = "";
  form.newPassword = "";
  form.confirmPassword = "";
  oldPwdVisible.value = false;
  newPwdVisible.value = false;
  confirmVisible.value = false;
  submitting.value = false;
};

watch(
  () => props.open,
  (open) => {
    if (open) return;
    reset();
  },
);

const validatePassword = (pwd) => passwordRegex.test(String(pwd || ""));

const handleSubmit = async () => {
  if (!canSubmit.value) return;

  const oldPwd = String(form.oldPassword || "");
  const newPwd = String(form.newPassword || "");
  const confirm = String(form.confirmPassword || "");

  if (!oldPwd.trim() || !newPwd.trim() || !confirm.trim()) {
    message.warning("请完整填写密码信息");
    return;
  }

  if (!validatePassword(newPwd)) {
    message.warning("密码需包含大小写字母和数字，长度至少8位");
    return;
  }

  if (newPwd !== confirm) {
    message.warning("两次新密码不一致");
    return;
  }

  submitting.value = true;
  try {
    await changePassword({
      old_password: oldPwd,
      new_password: newPwd,
    });

    message.success("密码修改成功，请重新登录");

    // A 方案：修改成功后登出并跳转登录页
    authStore.logout();
    emit("update:open", false);
    router.replace("/auth");
  } catch (error) {
    message.error(error?.message || "密码修改失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <a-modal
    :open="props.open"
    :confirmLoading="submitting"
    :okButtonProps="{ disabled: !canSubmit }"
    :maskClosable="false"
    :keyboard="false"
    title="修改密码"
    okText="确认修改"
    cancelText="取消"
    @ok="handleSubmit"
    @cancel="close"
  >
    <div class="pwd-modal">
      <div class="tip">
        <LockOutlined />
        <span>密码需包含大小写字母和数字，长度至少8位</span>
      </div>

      <a-form layout="vertical" @submit.prevent>
        <a-form-item label="旧密码">
          <a-input
            v-model:value="form.oldPassword"
            :type="oldPwdVisible ? 'text' : 'password'"
            placeholder="请输入旧密码"
            :disabled="submitting"
            size="large"
            :bordered="false"
            class="underline-input"
          >
            <template #suffix>
              <span
                class="pwd-toggle"
                :class="{ 'is-hidden': !oldPwdVisible }"
                @mousedown.prevent
                @click.prevent="oldPwdVisible = !oldPwdVisible"
              >
                <EyeOutlined />
              </span>
            </template>
          </a-input>
        </a-form-item>

        <a-form-item label="新密码">
          <a-input
            v-model:value="form.newPassword"
            :type="newPwdVisible ? 'text' : 'password'"
            placeholder="请输入新密码"
            :disabled="submitting"
            size="large"
            :bordered="false"
            class="underline-input"
          >
            <template #suffix>
              <span
                class="pwd-toggle"
                :class="{ 'is-hidden': !newPwdVisible }"
                @mousedown.prevent
                @click.prevent="newPwdVisible = !newPwdVisible"
              >
                <EyeOutlined />
              </span>
            </template>
          </a-input>
        </a-form-item>

        <a-form-item label="确认新密码">
          <a-input
            v-model:value="form.confirmPassword"
            :type="confirmVisible ? 'text' : 'password'"
            placeholder="请再次输入新密码"
            :disabled="submitting"
            size="large"
            :bordered="false"
            class="underline-input"
          >
            <template #suffix>
              <span
                class="pwd-toggle"
                :class="{ 'is-hidden': !confirmVisible }"
                @mousedown.prevent
                @click.prevent="confirmVisible = !confirmVisible"
              >
                <EyeOutlined />
              </span>
            </template>
          </a-input>
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>

<style scoped>
.pwd-modal {
  padding-top: 6px;
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
  border-bottom: 1px solid var(--line-color, #e6e9ef) !important;
}

:global(.ant-input.underline-input:focus) {
  border-bottom: 1px solid var(--brand-color, #78c841) !important;
  box-shadow: none !important;
}

:global(.ant-input-affix-wrapper.underline-input) {
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line-color, #e6e9ef) !important;
}

:global(.ant-input-affix-wrapper-focused.underline-input) {
  border-bottom: 1px solid var(--brand-color, #78c841) !important;
  box-shadow: none !important;
}

:global(.ant-input-affix-wrapper.underline-input .anticon) {
  color: #a0aec0;
}

.tip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 12px;
}

.pwd-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: pointer;
  color: #9aa5b1;
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
</style>
