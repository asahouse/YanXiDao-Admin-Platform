<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCourseStore } from '../../stores/courseStore'
import { adminFetch } from '../../utils/adminApi'
import {
  Database,
  Download,
  Upload,
  CloudDownload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileJson,
  ShieldCheck,
  Sparkles,
  BookOpen,
  CheckSquare,
  Square,
  Server,
} from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'synced'): void
}>()

const courseStore = useCourseStore()

interface SyncStatus {
  engine: string
  dbPath: string
  dbSizeBytes: number
  contentVersion: string
  lastSyncAt: string
  remoteSyncUrl: string
  counts: {
    courses: number
    teaching: number
    totalCourses: number
    lessons: number
    sentences: number
    words: number
    ttsDict: number
    users: number
  }
}

const status = ref<SyncStatus | null>(null)
const isLoadingStatus = ref(false)

// Export state
const exportMode = ref<'all' | 'selected'>('all')
const selectedExportCourseIds = ref<string[]>([])
const isExporting = ref(false)

// Import offline package state
const fileInputRef = ref<HTMLInputElement | null>(null)
const parsedBundle = ref<any | null>(null)
const selectedFileName = ref('')
const isImporting = ref(false)
const updateBuiltinSnapshotOnImport = ref(true)

// Remote sync state
const remoteUrlInput = ref('')
const isSyncingRemote = ref(false)
const isSavingConfig = ref(false)

// Feedback banner
const feedbackType = ref<'success' | 'error' | ''>('')
const feedbackMessage = ref('')

function showFeedback(type: 'success' | 'error', msg: string) {
  feedbackType.value = type
  feedbackMessage.value = msg
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDateTime(iso: string): string {
  if (!iso) return '尚未记录'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

async function fetchStatus() {
  try {
    isLoadingStatus.value = true
    const res = await adminFetch('/api/sync/status')
    if (res.ok) {
      const data = await res.json()
      status.value = data
      if (!remoteUrlInput.value && data.remoteSyncUrl) {
        remoteUrlInput.value = data.remoteSyncUrl
      }
    }
  } catch (err) {
    console.error('Failed to fetch sync status:', err)
  } finally {
    isLoadingStatus.value = false
  }
}

const allCoursesList = computed(() => [
  ...courseStore.courses,
  ...courseStore.teachingMaterials,
])

function toggleSelectCourse(id: string) {
  const idx = selectedExportCourseIds.value.indexOf(id)
  if (idx >= 0) {
    selectedExportCourseIds.value.splice(idx, 1)
  } else {
    selectedExportCourseIds.value.push(id)
  }
}

function selectAllCourses() {
  selectedExportCourseIds.value = allCoursesList.value.map(c => c.id)
}

function clearSelectedCourses() {
  selectedExportCourseIds.value = []
}

async function handleExportBundle() {
  try {
    isExporting.value = true
    feedbackMessage.value = ''

    let url = '/api/sync/export'
    if (exportMode.value === 'selected') {
      if (selectedExportCourseIds.value.length === 0) {
        showFeedback('error', '请至少勾选一门要导出的课程或教辅教材')
        return
      }
      url += `?courseIds=${encodeURIComponent(selectedExportCourseIds.value.join(','))}`
    }

    const res = await adminFetch(url)
    if (!res.ok) {
      throw new Error('导出题库包请求失败')
    }
    const bundle = await res.json()
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' })
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const suffix = exportMode.value === 'all' ? 'full' : `${selectedExportCourseIds.value.length}courses`
    a.href = downloadUrl
    a.download = `yanxidao-courses-${dateTag}-${suffix}.yxdpack`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)

    showFeedback(
      'success',
      `成功导出离线课程包（版本 ${bundle.contentVersion}）：含 ${bundle.summary.totalCoursesCount} 门课程/教辅、${bundle.summary.lessonsCount} 个小节、${bundle.summary.sentencesCount} 条句子！`
    )
  } catch (err: any) {
    showFeedback('error', err.message || '导出失败')
  } finally {
    isExporting.value = false
  }
}

function triggerFileSelect() {
  fileInputRef.value?.click()
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  selectedFileName.value = file.name
  feedbackMessage.value = ''

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const json = JSON.parse(String(reader.result || ''))
      if (!json || (!json.data && !json.tables)) {
        throw new Error('文件结构不符合研习岛课程包 (.yxdpack) 规范')
      }
      parsedBundle.value = json
    } catch (err: any) {
      parsedBundle.value = null
      showFeedback('error', `解析更新包失败：${err.message}`)
    }
  }
  reader.readAsText(file, 'utf-8')
}

async function handleConfirmImportBundle() {
  if (!parsedBundle.value) return
  try {
    isImporting.value = true
    feedbackMessage.value = ''

    const res = await adminFetch('/api/sync/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundle: parsedBundle.value,
        updateBuiltinSnapshot: updateBuiltinSnapshotOnImport.value,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || '导入题库包失败')
    }

    showFeedback('success', data.message)
    parsedBundle.value = null
    selectedFileName.value = ''
    if (fileInputRef.value) fileInputRef.value.value = ''

    await fetchStatus()
    await courseStore.fetchCourses()
    emit('synced')
  } catch (err: any) {
    showFeedback('error', err.message || '导入题库包异常')
  } finally {
    isImporting.value = false
  }
}

async function handleSaveRemoteConfig() {
  try {
    isSavingConfig.value = true
    const res = await adminFetch('/api/sync/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remoteSyncUrl: remoteUrlInput.value.trim() }),
    })
    if (res.ok) {
      showFeedback('success', '云端题库同步地址已保存')
      await fetchStatus()
    }
  } catch (err: any) {
    showFeedback('error', err.message || '保存配置失败')
  } finally {
    isSavingConfig.value = false
  }
}

async function handleRemoteSync() {
  if (!remoteUrlInput.value.trim()) {
    showFeedback('error', '请先输入云端 Web 服务器地址或课程包 URL（例如 http://localhost:3001 或 https://你的域名/api/sync/export）')
    return
  }
  try {
    isSyncingRemote.value = true
    feedbackMessage.value = ''

    const res = await adminFetch('/api/sync/remote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remoteUrl: remoteUrlInput.value.trim() }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || '云端同步失败')
    }

    showFeedback('success', data.message)
    await fetchStatus()
    await courseStore.fetchCourses()
    emit('synced')
  } catch (err: any) {
    showFeedback('error', err.message || '云端拉取失败')
  } finally {
    isSyncingRemote.value = false
  }
}

onMounted(async () => {
  await fetchStatus()
  if (courseStore.courses.length === 0) {
    await courseStore.fetchCourses()
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Top Banner: Public Content vs Personal Data Isolation Guarantee -->
    <div class="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-500/15 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck class="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="text-sm font-bold text-white">公共题库与个人学情双轨解耦架构 (Upsert 无损热更)</h3>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              学员数据 100% 保护
            </span>
          </div>
          <p class="text-xs text-slate-300 mt-1 leading-relaxed">
            支持 <strong>Web 端在线导出 `.yxdpack` 离线更新包</strong>、<strong>桌面安装包导入离线包</strong> 以及 <strong>一键从云端 URL 拉取最新课程</strong>。更新过程采用 SQLite 原子事务合并公共课程表，绝不覆盖任何学员的打卡天数、学习进度、错题本与个人收藏。
          </p>
        </div>
      </div>

      <button
        @click="fetchStatus"
        :disabled="isLoadingStatus"
        class="px-3.5 py-2 rounded-xl bg-[#1a2035] hover:bg-[#232b46] border border-[#2d3656] text-xs font-medium text-slate-200 flex items-center gap-1.5 shrink-0 cursor-pointer transition-all self-start sm:self-center"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoadingStatus }" />
        <span>刷新状态</span>
      </button>
    </div>

    <!-- Feedback Alert -->
    <div
      v-if="feedbackMessage"
      :class="[
        'p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-medium transition-all',
        feedbackType === 'success'
          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
          : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
      ]"
    >
      <div class="flex items-center gap-2.5">
        <CheckCircle2 v-if="feedbackType === 'success'" class="w-4 h-4 text-emerald-400 shrink-0" />
        <AlertTriangle v-else class="w-4 h-4 text-rose-400 shrink-0" />
        <span>{{ feedbackMessage }}</span>
      </div>
      <button @click="feedbackMessage = ''" class="text-xs opacity-70 hover:opacity-100 cursor-pointer">✕</button>
    </div>

    <!-- Database & Content Version Status Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="p-4 rounded-2xl bg-[#141826] border border-[#22283e] space-y-1.5">
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span>嵌入式数据库引擎</span>
          <Database class="w-4 h-4 text-indigo-400" />
        </div>
        <div class="text-base font-bold text-white flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{{ status?.engine || 'SQLite (Embedded)' }}</span>
        </div>
        <div class="text-[11px] text-slate-500 truncate" :title="status?.dbPath">
          体积: {{ formatBytes(status?.dbSizeBytes || 0) }} · 零外部服务依赖
        </div>
      </div>

      <div class="p-4 rounded-2xl bg-[#141826] border border-[#22283e] space-y-1.5">
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span>当前本地题库版本号</span>
          <Sparkles class="w-4 h-4 text-amber-400" />
        </div>
        <div class="text-base font-bold text-amber-300 font-mono">
          v{{ status?.contentVersion || '2026.11.07.1' }}
        </div>
        <div class="text-[11px] text-slate-500">
          上次同步: {{ formatDateTime(status?.lastSyncAt || '') }}
        </div>
      </div>

      <div class="p-4 rounded-2xl bg-[#141826] border border-[#22283e] space-y-1.5">
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span>公共题库内容规模</span>
          <BookOpen class="w-4 h-4 text-sky-400" />
        </div>
        <div class="text-base font-bold text-white">
          {{ status?.counts.courses || 0 }} 课程 · {{ status?.counts.teaching || 0 }} 教辅
        </div>
        <div class="text-[11px] text-slate-500">
          共 {{ status?.counts.lessons || 0 }} 小节 · {{ status?.counts.sentences || 0 }} 句 · {{ status?.counts.words || 0 }} 词
        </div>
      </div>

      <div class="p-4 rounded-2xl bg-[#141826] border border-[#22283e] space-y-1.5">
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span>受保护的本地学情档案</span>
          <ShieldCheck class="w-4 h-4 text-emerald-400" />
        </div>
        <div class="text-base font-bold text-emerald-400">
          {{ status?.counts.users || 0 }} 位学员账户
        </div>
        <div class="text-[11px] text-slate-500">
          打卡、进度、复习本与题库更新完全隔离
        </div>
      </div>
    </div>

    <!-- Three Core Action Panels -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <!-- Panel 1: Export Offline Course Package -->
      <div class="p-5 rounded-2xl bg-[#141826] border border-[#22283e] flex flex-col justify-between space-y-4">
        <div class="space-y-4">
          <div class="flex items-center gap-2.5 border-b border-[#22283e] pb-3">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Download class="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-white">1. 导出离线课程包 (.yxdpack)</h4>
              <p class="text-[11px] text-slate-400">在 Web 端或管理端编排好课程后打包分发</p>
            </div>
          </div>

          <!-- Export Scope Toggle -->
          <div class="space-y-2 text-xs">
            <label class="block text-slate-400 font-medium">选择导出范围：</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                @click="exportMode = 'all'"
                :class="[
                  'px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all',
                  exportMode === 'all'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-[#0e121f] border-[#252b41] text-slate-400 hover:text-white'
                ]"
              >
                全量导出全部课程 ({{ allCoursesList.length }})
              </button>
              <button
                @click="exportMode = 'selected'"
                :class="[
                  'px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all',
                  exportMode === 'selected'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-[#0e121f] border-[#252b41] text-slate-400 hover:text-white'
                ]"
              >
                勾选导出指定课程
              </button>
            </div>
          </div>

          <!-- Selective Course Checklist -->
          <div v-if="exportMode === 'selected'" class="space-y-2">
            <div class="flex items-center justify-between text-[11px] text-slate-400">
              <span>已选 {{ selectedExportCourseIds.length }} / {{ allCoursesList.length }} 门</span>
              <div class="flex items-center gap-2">
                <button @click="selectAllCourses" class="text-indigo-400 hover:underline cursor-pointer">全选</button>
                <button @click="clearSelectedCourses" class="text-slate-400 hover:underline cursor-pointer">清空</button>
              </div>
            </div>
            <div class="max-h-44 overflow-y-auto space-y-1.5 pr-1 bg-[#0e121f] p-2.5 rounded-xl border border-[#22283e]">
              <div
                v-for="item in allCoursesList"
                :key="item.id"
                @click="toggleSelectCourse(item.id)"
                class="flex items-center justify-between p-2 rounded-lg hover:bg-[#181e31] cursor-pointer text-xs transition-colors"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <CheckSquare v-if="selectedExportCourseIds.includes(item.id)" class="w-4 h-4 text-indigo-400 shrink-0" />
                  <Square v-else class="w-4 h-4 text-slate-600 shrink-0" />
                  <span class="truncate text-slate-200">{{ item.title }}</span>
                </div>
                <span
                  :class="[
                    'px-1.5 py-0.5 rounded text-[10px] shrink-0 ml-2',
                    item.type === 'teaching' ? 'bg-amber-500/15 text-amber-300' : 'bg-indigo-500/15 text-indigo-300'
                  ]"
                >
                  {{ item.type === 'teaching' ? '教辅' : '课程' }} · {{ item.lessonCount }}节
                </span>
              </div>
            </div>
          </div>

          <div v-else class="p-3 rounded-xl bg-[#0e121f] border border-[#22283e] text-[11px] text-slate-400 space-y-1 leading-relaxed">
            <div>• 自动打包所有课程、同步教辅、章节分类、小节句子、逐词音标及 TTS 词典</div>
            <div>• 自动剔除所有个人打卡、练习时长与复习记录，生成纯净题库分发包</div>
          </div>
        </div>

        <button
          @click="handleExportBundle"
          :disabled="isExporting"
          class="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer transition-all"
        >
          <Download class="w-4 h-4" />
          <span>{{ isExporting ? '正在打包导出...' : '导出离线课程包 (.yxdpack)' }}</span>
        </button>
      </div>

      <!-- Panel 2: Import Offline Course Package -->
      <div class="p-5 rounded-2xl bg-[#141826] border border-[#22283e] flex flex-col justify-between space-y-4">
        <div class="space-y-4">
          <div class="flex items-center gap-2.5 border-b border-[#22283e] pb-3">
            <div class="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Upload class="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-white">2. 导入离线课程包 (本地热更新)</h4>
              <p class="text-[11px] text-slate-400">桌面版无需重装软件，选包即可增量升级题库</p>
            </div>
          </div>

          <input
            ref="fileInputRef"
            type="file"
            accept=".yxdpack,.json,application/json"
            class="hidden"
            @change="handleFileChange"
          />

          <div
            @click="triggerFileSelect"
            class="p-5 rounded-xl border-2 border-dashed border-[#2a324d] hover:border-emerald-500/60 bg-[#0e121f] hover:bg-emerald-500/5 transition-all cursor-pointer text-center space-y-2"
          >
            <FileJson class="w-8 h-8 text-emerald-400 mx-auto" />
            <div class="text-xs font-semibold text-slate-200">
              {{ selectedFileName || '点击选择 .yxdpack 或 .json 课程更新包' }}
            </div>
            <div class="text-[11px] text-slate-500">
              支持全量包或单课程增量包，自动按 ID 匹配新增或覆盖小节
            </div>
          </div>

          <!-- Parsed Bundle Preview -->
          <div v-if="parsedBundle" class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 text-xs">
            <div class="flex items-center justify-between font-bold text-emerald-300">
              <span>已解析更新包：v{{ parsedBundle.contentVersion || '未知版本' }}</span>
              <span class="text-[10px] font-normal text-emerald-400/80">{{ formatDateTime(parsedBundle.exportedAt) }}</span>
            </div>
            <div class="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
              <div>• 课程/教辅：<strong>{{ parsedBundle.summary?.totalCoursesCount ?? parsedBundle.data?.courses?.length ?? 0 }}</strong> 门</div>
              <div>• 章节小节：<strong>{{ parsedBundle.summary?.lessonsCount ?? parsedBundle.data?.lessons?.length ?? 0 }}</strong> 节</div>
              <div>• 精听句子：<strong>{{ parsedBundle.summary?.sentencesCount ?? parsedBundle.data?.sentences?.length ?? 0 }}</strong> 句</div>
              <div>• 词典规则：<strong>{{ parsedBundle.summary?.ttsDictCount ?? parsedBundle.data?.ttsDictionary?.length ?? 0 }}</strong> 条</div>
            </div>
          </div>

          <label class="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              v-model="updateBuiltinSnapshotOnImport"
              class="rounded border-slate-600 text-emerald-500 focus:ring-0"
            />
            <span>同时更新内置出厂快照 (builtin-snapshot.json)</span>
          </label>
        </div>

        <button
          @click="handleConfirmImportBundle"
          :disabled="!parsedBundle || isImporting"
          class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all"
        >
          <CheckCircle2 class="w-4 h-4" />
          <span>{{ isImporting ? '正在执行原子事务合并...' : '立即增量合并入库' }}</span>
        </button>
      </div>

      <!-- Panel 3: Remote Cloud / LAN Auto-Sync -->
      <div class="p-5 rounded-2xl bg-[#141826] border border-[#22283e] flex flex-col justify-between space-y-4">
        <div class="space-y-4">
          <div class="flex items-center gap-2.5 border-b border-[#22283e] pb-3">
            <div class="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <CloudDownload class="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-white">3. 云端 / 局域网一键同步课程</h4>
              <p class="text-[11px] text-slate-400">桌面版联网直连 Web 端服务器拉取最新题库</p>
            </div>
          </div>

          <div class="space-y-2 text-xs">
            <label class="block text-slate-400 font-medium flex items-center justify-between">
              <span>远端 Web 题库源地址 (URL)</span>
              <button
                @click="handleSaveRemoteConfig"
                :disabled="isSavingConfig"
                class="text-[11px] text-sky-400 hover:underline cursor-pointer"
              >
                {{ isSavingConfig ? '保存中...' : '保存默认地址' }}
              </button>
            </label>
            <div class="relative">
              <input
                v-model="remoteUrlInput"
                placeholder="例如: https://yanxidao.example.com 或 http://192.168.1.100:3001"
                class="w-full px-3 py-2.5 rounded-xl bg-[#0e121f] border border-[#252b41] text-white text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <p class="text-[11px] text-slate-500 leading-relaxed">
              可填写线上 Web 版根域名（系统会自动请求其 <code class="text-slate-300">/api/sync/export</code> 接口）或直接填写对象存储上的 <code class="text-slate-300">.yxdpack</code> 静态文件地址。
            </p>
          </div>

          <div class="p-3 rounded-xl bg-[#0e121f] border border-[#22283e] text-[11px] text-slate-400 space-y-1.5">
            <div class="font-semibold text-slate-300 flex items-center gap-1.5">
              <Server class="w-3.5 h-3.5 text-sky-400" />
              <span>适用场景说明：</span>
            </div>
            <div>• <strong>在线 Web 版更新后</strong>：桌面客户端只需点击下方按钮，数秒内即可将新课程同步到本地 SQLite。</div>
            <div>• <strong>机房/教室局域网</strong>：填入教师机 IP（如 <code class="text-slate-300">http://192.168.1.88:3001</code>），所有学生机一键同步。</div>
          </div>
        </div>

        <button
          @click="handleRemoteSync"
          :disabled="isSyncingRemote"
          class="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 cursor-pointer transition-all"
        >
          <CloudDownload class="w-4 h-4" :class="{ 'animate-bounce': isSyncingRemote }" />
          <span>{{ isSyncingRemote ? '正在连接云端拉取题库...' : '立即从云端同步最新课程' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
