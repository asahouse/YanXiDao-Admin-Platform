<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Crown, Send, CheckCircle2, XCircle, RefreshCw, MessageSquare, Clock } from 'lucide-vue-next'
import { adminFetch } from '../../utils/adminApi'
import { VIP_TYPE_INFO, type VipType } from '../../utils/levelRules'
import { splitTextWithLinks } from '../../utils/textLinks'

interface VipUpgradeRequest {
  id: string
  userId: string
  userEmail: string
  userNickname: string
  currentVipType: VipType
  targetVipType: VipType
  status: 'pending' | 'replied' | 'approved' | 'rejected'
  createdAt: string
  updatedAt: string
}

interface VipUpgradeMessage {
  id: string
  requestId: string
  senderRole: 'user' | 'admin'
  senderName: string
  content: string
  createdAt: string
}

const loading = ref(false)
const statusFilter = ref<'all' | 'pending' | 'replied' | 'approved' | 'rejected'>('all')
const requests = ref<VipUpgradeRequest[]>([])
const messagesMap = ref<Record<string, VipUpgradeMessage[]>>({})
const pendingCount = ref(0)
const replyDrafts = ref<Record<string, string>>({})
const busyMap = ref<Record<string, boolean>>({})
const toastMsg = ref('')
const errorMsg = ref('')

const statusLabels: Record<string, { text: string; cls: string }> = {
  pending: { text: '待处理', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  replied: { text: '已回复链接', cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  approved: { text: '已通过开通', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  rejected: { text: '未通过', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
}

async function fetchRequests() {
  loading.value = true
  errorMsg.value = ''
  try {
    const q = statusFilter.value === 'all' ? '' : `?status=${statusFilter.value}`
    const res = await adminFetch(`/api/admin/vip-requests${q}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '加载申请列表失败')
    requests.value = data.requests || []
    messagesMap.value = data.messagesMap || {}
    pendingCount.value = Number(data.pendingCount || 0)
  } catch (e: any) {
    errorMsg.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function sendReply(reqId: string) {
  const content = (replyDrafts.value[reqId] || '').trim()
  if (!content) return
  busyMap.value[reqId] = true
  errorMsg.value = ''
  toastMsg.value = ''
  try {
    const res = await adminFetch(`/api/admin/vip-requests/${reqId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '发送回复失败')
    replyDrafts.value[reqId] = ''
    toastMsg.value = '已发送文本/支付链接回复'
    await fetchRequests()
  } catch (e: any) {
    errorMsg.value = e.message || '发送失败'
  } finally {
    busyMap.value[reqId] = false
  }
}

async function updateStatus(reqId: string, status: 'approved' | 'rejected') {
  busyMap.value[reqId] = true
  errorMsg.value = ''
  toastMsg.value = ''
  try {
    const res = await adminFetch(`/api/admin/vip-requests/${reqId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '状态更新失败')
    toastMsg.value = status === 'approved' ? '已审批通过并自动为用户开通对应 VIP 权限' : '已将申请状态设为未通过（仍可继续来回沟通）'
    await fetchRequests()
  } catch (e: any) {
    errorMsg.value = e.message || '更新失败'
  } finally {
    busyMap.value[reqId] = false
  }
}

onMounted(fetchRequests)
</script>

<template>
  <div class="space-y-4">
    <!-- Top bar -->
    <div class="p-5 rounded-2xl bg-[#141826] border border-[#22283e] flex flex-wrap items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2 text-base font-bold text-white">
          <Crown class="w-5 h-5 text-amber-400" />
          <span>会员升级申请管理</span>
          <span
            v-if="pendingCount > 0"
            class="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30"
          >
            {{ pendingCount }} 条待处理/沟通中
          </span>
        </div>
        <p class="text-xs text-slate-400">
          收到用户的升级申请后，可先回复文本或支付链接，再决定「通过并开通 VIP」或「不通过」；已处理的记录仍支持双方继续来回回复沟通。
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="tab in [
            { key: 'all', label: '全部' },
            { key: 'pending', label: '待处理' },
            { key: 'replied', label: '已回复' },
            { key: 'approved', label: '已通过' },
            { key: 'rejected', label: '未通过' },
          ]"
          :key="tab.key"
          @click="statusFilter = tab.key as any; fetchRequests()"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            statusFilter === tab.key ? 'bg-indigo-600 text-white' : 'bg-[#1c2235] text-slate-400 hover:text-white'
          ]"
        >
          {{ tab.label }}
        </button>

        <button
          @click="fetchRequests"
          :disabled="loading"
          class="px-3 py-1.5 rounded-lg bg-[#1c2235] hover:bg-[#252c44] text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw :class="['w-3.5 h-3.5', loading ? 'animate-spin' : '']" />
          <span>刷新</span>
        </button>
      </div>
    </div>

    <div v-if="toastMsg" class="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
      {{ toastMsg }}
    </div>
    <div v-if="errorMsg" class="px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
      {{ errorMsg }}
    </div>

    <!-- Empty state -->
    <div v-if="!loading && requests.length === 0" class="p-10 rounded-2xl bg-[#141826] border border-[#22283e] text-center text-slate-400 text-sm">
      当前筛选条件下暂无会员升级申请。
    </div>

    <!-- Request cards -->
    <div v-else class="space-y-4">
      <div
        v-for="req in requests"
        :key="req.id"
        class="p-5 rounded-2xl bg-[#141826] border border-[#22283e] space-y-4"
      >
        <!-- Header -->
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-bold text-white">{{ req.userNickname || '未命名用户' }}</span>
              <span class="text-xs text-slate-400">{{ req.userEmail || req.userId }}</span>
              <span :class="['px-2 py-0.5 rounded-full text-[11px] font-semibold border', statusLabels[req.status]?.cls]">
                {{ statusLabels[req.status]?.text || req.status }}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span>当前类型：</span>
              <span class="px-2 py-0.5 rounded bg-[#1d2336] text-slate-200 font-medium">
                {{ VIP_TYPE_INFO[req.currentVipType]?.label || req.currentVipType }}
              </span>
              <span class="text-slate-500">→</span>
              <span>申请升级为：</span>
              <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                {{ VIP_TYPE_INFO[req.targetVipType]?.label || req.targetVipType }}
              </span>
              <span class="text-slate-500 flex items-center gap-1 ml-2">
                <Clock class="w-3 h-3" />
                {{ req.createdAt }}
              </span>
            </div>
          </div>

          <!-- Status Actions -->
          <div class="flex items-center gap-2">
            <button
              v-if="req.status !== 'approved'"
              @click="updateStatus(req.id, 'approved')"
              :disabled="busyMap[req.id]"
              class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 class="w-3.5 h-3.5" />
              <span>通过并开通 VIP</span>
            </button>
            <button
              v-if="req.status !== 'rejected'"
              @click="updateStatus(req.id, 'rejected')"
              :disabled="busyMap[req.id]"
              class="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <XCircle class="w-3.5 h-3.5" />
              <span>不通过</span>
            </button>
          </div>
        </div>

        <!-- Messages thread -->
        <div class="rounded-xl bg-[#0e121e] border border-[#1f263d] p-3.5 space-y-2.5">
          <div class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <MessageSquare class="w-3.5 h-3.5" />
            <span>沟通记录与支付链接</span>
          </div>

          <div v-if="!(messagesMap[req.id] && messagesMap[req.id].length)" class="text-xs text-slate-500 py-1">
            暂无留言记录，请在下方发送文本说明或升级支付链接。
          </div>

          <div
            v-for="msg in messagesMap[req.id] || []"
            :key="msg.id"
            :class="[
              'p-2.5 rounded-lg text-xs space-y-1',
              msg.senderRole === 'admin'
                ? 'bg-indigo-500/15 border border-indigo-500/25 text-indigo-100 ml-6'
                : 'bg-[#171c2e] border border-[#252d47] text-slate-200 mr-6'
            ]"
          >
            <div class="flex items-center justify-between text-[11px] opacity-75">
              <span class="font-semibold">
                {{ msg.senderRole === 'admin' ? `管理员 (${msg.senderName || 'admin'})` : `用户 (${msg.senderName || '学员'})` }}
              </span>
              <span>{{ msg.createdAt }}</span>
            </div>
            <div class="whitespace-pre-wrap break-all leading-relaxed">
              <template v-for="(seg, idx) in splitTextWithLinks(msg.content)" :key="idx">
                <a
                  v-if="seg.isLink"
                  :href="seg.text"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-amber-300 underline hover:text-amber-200"
                >
                  {{ seg.text }}
                </a>
                <span v-else>{{ seg.text }}</span>
              </template>
            </div>
          </div>

          <!-- Reply box -->
          <div class="flex items-center gap-2 pt-1">
            <input
              v-model="replyDrafts[req.id]"
              type="text"
              placeholder="输入回复文本或升级支付链接（如 https://... ）"
              @keyup.enter="sendReply(req.id)"
              class="flex-1 px-3 py-2 rounded-lg bg-[#161b2c] border border-[#28314d] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              @click="sendReply(req.id)"
              :disabled="busyMap[req.id] || !(replyDrafts[req.id] || '').trim()"
              class="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send class="w-3.5 h-3.5" />
              <span>发送回复</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
