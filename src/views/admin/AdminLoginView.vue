<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { setAdminSession } from '../../utils/adminApi'
import { ShieldCheck, User, Lock, LogIn } from 'lucide-vue-next'

const router = useRouter()

const username = ref('admin')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleAdminLogin() {
  if (!username.value.trim() || !password.value) {
    errorMsg.value = '请输入管理员账号和密码'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value.trim(),
        password: password.value,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || '登录失败')
    }
    setAdminSession(data.token, data.admin)
    router.push('/admin')
  } catch (err: unknown) {
    errorMsg.value = (err as Error).message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen w-full flex items-center justify-center bg-[#070910] text-white p-4 relative">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-[#070910] to-[#070910] pointer-events-none"></div>

    <div class="w-full max-w-md bg-[#111524] border border-purple-500/25 rounded-3xl p-8 shadow-2xl relative z-10">
      <div class="text-center mb-7">
        <div class="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
          <ShieldCheck class="w-7 h-7" />
        </div>
        <h1 class="text-xl font-bold text-white tracking-wide">研习岛 · 独立后台管理平台</h1>
        <p class="text-xs text-slate-400 mt-1">管理员专属身份认证入口（与前台学员账号完全隔离）</p>
      </div>

      <div v-if="errorMsg" class="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
        {{ errorMsg }}
      </div>

      <form @submit.prevent="handleAdminLogin" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">管理员账号</label>
          <div class="relative">
            <User class="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              v-model="username"
              type="text"
              required
              placeholder="admin"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#181d30] border border-[#2a3350] text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">管理员密码</label>
          <div class="relative">
            <Lock class="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              v-model="password"
              type="password"
              required
              placeholder="请输入管理员密码"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#181d30] border border-[#2a3350] text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all cursor-pointer mt-2"
        >
          <LogIn class="w-4 h-4" />
          <span>{{ loading ? '验证中...' : '登录后台管理平台' }}</span>
        </button>
      </form>
    </div>
  </div>
</template>
