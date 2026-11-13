<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminFetch } from '../../utils/adminApi'
import { Mail, Send, RefreshCw, CheckCircle2, AlertTriangle, Server } from 'lucide-vue-next'

const smtp = ref({
  host: '',
  port: 465,
  secure: true,
  user: '',
  pass: '',
  fromName: '研习岛 YanXiDao',
  fromAddress: '',
  enabled: false,
})

const testEmail = ref('')
const saving = ref(false)
const testing = ref(false)
const feedback = ref<{ type: 'ok' | 'err'; msg: string } | null>(null)
const emailLogs = ref<any[]>([])
const loadingLogs = ref(false)

async function loadSmtp() {
  try {
    const res = await adminFetch('/api/admin/smtp')
    if (res.ok) {
      const data = await res.json()
      smtp.value = { ...smtp.value, ...data }
    }
  } catch {}
}

async function loadEmailLogs() {
  loadingLogs.value = true
  try {
    const res = await adminFetch('/api/admin/email-logs?limit=50')
    if (res.ok) {
      emailLogs.value = await res.json()
    }
  } finally {
    loadingLogs.value = false
  }
}

async function saveSmtp() {
  saving.value = true
  feedback.value = null
  try {
    const res = await adminFetch('/api/admin/smtp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(smtp.value),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '保存失败')
    feedback.value = { type: 'ok', msg: 'SMTP 配置已保存' }
  } catch (err: any) {
    feedback.value = { type: 'err', msg: err.message }
  } finally {
    saving.value = false
  }
}

async function sendTest() {
  if (!testEmail.value.trim()) {
    feedback.value = { type: 'err', msg: '请输入测试收件邮箱' }
    return
  }
  testing.value = true
  feedback.value = null
  try {
    const res = await adminFetch('/api/admin/smtp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toEmail: testEmail.value.trim() }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '发送失败')
    feedback.value = {
      type: 'ok',
      msg: data.status === 'simulated'
        ? '当前未启用真实 SMTP，已生成模拟发信记录（可在下方日志查看）'
        : '测试邮件已通过真实 SMTP 发送成功',
    }
    await loadEmailLogs()
  } catch (err: any) {
    feedback.value = { type: 'err', msg: err.message }
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  loadSmtp()
  loadEmailLogs()
})
</script>

<template>
  <div class="space-y-6">
    <!-- SMTP Config Card -->
    <div class="p-6 rounded-2xl bg-[#141826] border border-[#22283e] space-y-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <Server class="w-4 h-4 text-indigo-400" />
            <span>SMTP 邮件服务配置</span>
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            未启用真实 SMTP 时，系统自动将临时密码与改密链接写入「模拟发信箱」日志，管理员可直接复制凭据。
          </p>
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="smtp.enabled" type="checkbox" class="w-4 h-4 accent-indigo-500" />
          <span class="text-xs font-semibold text-slate-200">启用真实 SMTP 发信</span>
        </label>
      </div>

      <div v-if="feedback" :class="[
        'px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 border',
        feedback.type === 'ok'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
      ]">
        <CheckCircle2 v-if="feedback.type === 'ok'" class="w-4 h-4 shrink-0" />
        <AlertTriangle v-else class="w-4 h-4 shrink-0" />
        <span>{{ feedback.msg }}</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs text-slate-400 mb-1">SMTP 服务器 (Host)</label>
          <input v-model="smtp.host" type="text" placeholder="如 smtp.qq.com" class="w-full px-3 py-2 rounded-xl bg-[#0e111b] border border-[#252c44] text-xs text-white outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">端口 (Port)</label>
          <input v-model.number="smtp.port" type="number" placeholder="465" class="w-full px-3 py-2 rounded-xl bg-[#0e111b] border border-[#252c44] text-xs text-white outline-none focus:border-indigo-500" />
        </div>
        <div class="flex items-end pb-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="smtp.secure" type="checkbox" class="w-4 h-4 accent-indigo-500" />
            <span class="text-xs text-slate-300">使用 SSL/TLS (465端口建议开启)</span>
          </label>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">发信账号 (User)</label>
          <input v-model="smtp.user" type="text" placeholder="noreply@example.com" class="w-full px-3 py-2 rounded-xl bg-[#0e111b] border border-[#252c44] text-xs text-white outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">授权码 / 密码 (Pass)</label>
          <input v-model="smtp.pass" type="password" placeholder="留空或保持 ****** 则不修改" class="w-full px-3 py-2 rounded-xl bg-[#0e111b] border border-[#252c44] text-xs text-white outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">发件人显示名称</label>
          <input v-model="smtp.fromName" type="text" placeholder="研习岛 YanXiDao" class="w-full px-3 py-2 rounded-xl bg-[#0e111b] border border-[#252c44] text-xs text-white outline-none focus:border-indigo-500" />
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#22283e]">
        <div class="flex items-center gap-2">
          <input v-model="testEmail" type="email" placeholder="输入测试收件邮箱..." class="w-60 px-3 py-2 rounded-xl bg-[#0e111b] border border-[#252c44] text-xs text-white outline-none focus:border-indigo-500" />
          <button
            @click="sendTest"
            :disabled="testing"
            class="px-3.5 py-2 rounded-xl bg-[#22283e] hover:bg-[#2d3552] text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Send class="w-3.5 h-3.5" />
            <span>{{ testing ? '发送中...' : '发送测试邮件' }}</span>
          </button>
        </div>

        <button
          @click="saveSmtp"
          :disabled="saving"
          class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer"
        >
          {{ saving ? '保存中...' : '保存 SMTP 配置' }}
        </button>
      </div>
    </div>

    <!-- Email Logs / Simulated Outbox -->
    <div class="p-6 rounded-2xl bg-[#141826] border border-[#22283e] space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <Mail class="w-4 h-4 text-amber-400" />
          <span>系统发信记录与模拟发信箱 (最近50条)</span>
        </h3>
        <button
          @click="loadEmailLogs"
          class="px-3 py-1.5 rounded-lg bg-[#1d2235] hover:bg-[#272e47] text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loadingLogs }" />
          <span>刷新</span>
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-slate-400 border-b border-[#22283e]">
            <tr>
              <th class="py-2.5 pr-4">时间</th>
              <th class="py-2.5 pr-4">收件人</th>
              <th class="py-2.5 pr-4">主题</th>
              <th class="py-2.5 pr-4">状态</th>
              <th class="py-2.5">内容摘要</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#1d2235] text-slate-300">
            <tr v-if="emailLogs.length === 0">
              <td colspan="5" class="py-8 text-center text-slate-500">暂无发信记录</td>
            </tr>
            <tr v-for="log in emailLogs" :key="log.id" class="hover:bg-[#1a1f32]/60">
              <td class="py-2.5 pr-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">{{ log.createdAt }}</td>
              <td class="py-2.5 pr-4 font-mono">{{ log.toEmail }}</td>
              <td class="py-2.5 pr-4 font-medium text-white">{{ log.subject }}</td>
              <td class="py-2.5 pr-4">
                <span :class="[
                  'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                  log.status === 'sent' ? 'bg-emerald-500/15 text-emerald-300' :
                  log.status === 'simulated' ? 'bg-amber-500/15 text-amber-300' :
                  'bg-rose-500/15 text-rose-300'
                ]">
                  {{ log.status === 'sent' ? '已发送' : log.status === 'simulated' ? '模拟发出' : '发送失败' }}
                </span>
              </td>
              <td class="py-2.5 text-[11px] text-slate-400 max-w-md truncate" :title="log.contentPreview">
                {{ log.contentPreview }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
