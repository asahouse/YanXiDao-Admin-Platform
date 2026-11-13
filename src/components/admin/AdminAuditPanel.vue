<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminFetch } from '../../utils/adminApi'
import { ShieldCheck, RefreshCw } from 'lucide-vue-next'

const logs = ref<any[]>([])
const loading = ref(false)

async function loadLogs() {
  loading.value = true
  try {
    const res = await adminFetch('/api/admin/audit-logs?limit=100')
    if (res.ok) {
      logs.value = await res.json()
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadLogs)
</script>

<template>
  <div class="p-6 rounded-2xl bg-[#141826] border border-[#22283e] space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck class="w-4 h-4 text-emerald-400" />
          <span>后台操作审计日志</span>
        </h3>
        <p class="text-xs text-slate-400 mt-0.5">记录管理员创建账号、调整 VIP、停用/删除账号、重置密码与配置修改操作。</p>
      </div>
      <button
        @click="loadLogs"
        class="px-3 py-1.5 rounded-lg bg-[#1d2235] hover:bg-[#272e47] text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        <span>刷新</span>
      </button>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead class="text-slate-400 border-b border-[#22283e]">
          <tr>
            <th class="py-2.5 pr-4">时间</th>
            <th class="py-2.5 pr-4">管理员</th>
            <th class="py-2.5 pr-4">操作类型</th>
            <th class="py-2.5 pr-4">目标对象</th>
            <th class="py-2.5">详情</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#1d2235] text-slate-300">
          <tr v-if="logs.length === 0">
            <td colspan="5" class="py-8 text-center text-slate-500">暂无审计日志</td>
          </tr>
          <tr v-for="item in logs" :key="item.id" class="hover:bg-[#1a1f32]/60">
            <td class="py-2.5 pr-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">{{ item.createdAt }}</td>
            <td class="py-2.5 pr-4 font-mono text-indigo-300">{{ item.adminUsername }}</td>
            <td class="py-2.5 pr-4">
              <span class="px-2 py-0.5 rounded bg-[#1d2235] border border-[#2a314a] font-mono text-[11px] text-white">{{ item.action }}</span>
            </td>
            <td class="py-2.5 pr-4 font-mono text-slate-400">{{ item.targetUserId || '-' }}</td>
            <td class="py-2.5 text-slate-300">{{ item.detail }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
