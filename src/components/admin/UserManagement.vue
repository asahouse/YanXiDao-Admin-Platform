<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Users,
  Search,
  UserPlus,
  RotateCcw,
  Eye,
  Edit2,
  Trash2,
  ShieldCheck,
  Ban,
  Clock,
  BookOpen,
  Bookmark,
  CheckCircle2,
  AlertTriangle,
  Award,
  Volume2,
  X,
  Flame,
  Crown,
  KeyRound,
  Copy,
  Check,
  Sparkles,
} from 'lucide-vue-next'
import CustomSelect from '../common/CustomSelect.vue'
import { ttsService } from '../../services/ttsService'
import { adminFetch } from '../../utils/adminApi'
import { VIP_TYPE_INFO, calculateVipExpiration, type VipType } from '../../utils/levelRules'

export interface AdminUserItem {
  id: string
  nickname: string
  avatar: string
  role: string
  phone: string
  email: string
  status: 'active' | 'banned' | 'disabled'
  exp?: number
  level?: number
  vipType?: VipType
  vipExpireAt?: string | null
  hasEverVip?: boolean
  isVipActive?: boolean
  vipRemainingDays?: number
  totalStudySeconds: number
  todayStudySeconds: number
  monthStudySeconds: number
  totalSentenceCount: number
  todaySentenceCount: number
  continuousDays: number
  hasCheckedInToday?: boolean
  lastCheckinDate?: string | null
  createdAt: string
  updatedAt: string
  progressCount: number
  favCourseCount: number
  favSentenceCount: number
  reviewCount: number
  learnedCount: number
}

export interface UserProgressItem {
  id: string
  userId: string
  courseId: string
  courseTitle: string
  courseCover: string
  courseType: 'course' | 'teaching'
  courseCategory?: string
  courseSchoolLevel?: string
  courseGrade?: number
  lessonId: string
  lessonTitle: string
  lessonNumber: number
  totalCourseLessons: number
  sentenceIndex: number
  totalSentences: number
  progressPercent: number
  studySeconds: number
  lastPracticedAt: string
}

export interface UserFavoriteCourse {
  favId: string
  courseId: string
  title: string
  cover: string
  type: 'course' | 'teaching'
  instructorName: string
  lessonCount: number
  category?: string
  schoolLevel?: string
  grade?: number
  favoritedAt: string
}

export interface UserFavoriteSentence {
  id: string
  sentenceId?: string
  sentenceEn: string
  sentenceCn: string
  phonetic?: string
  courseTitle?: string
  createdAt: string
}

export interface UserReviewItem {
  id: string
  userId: string
  sentenceEn: string
  sentenceCn: string
  phonetic?: string
  words: { word: string; phonetic?: string }[]
  courseTitle?: string
  source: 'error' | 'unfamiliar'
  errorCount: number
  isLearned: boolean
  createdAt: string
}

// ----------------- State -----------------
const users = ref<AdminUserItem[]>([])
const isLoading = ref(false)
const searchKeyword = ref('')
const selectedRole = ref('all')
const selectedStatus = ref('all')
const selectedVipFilter = ref('all')

const vipFilterOptions = [
  { label: '全部会员类型', value: 'all' },
  { label: '普通免费用户', value: 'free' },
  { label: '月度 VIP', value: 'vip_monthly' },
  { label: '半年 VIP', value: 'vip_half_year' },
  { label: '终身 VIP', value: 'vip_lifetime' },
  { label: '已过期 VIP', value: 'expired' },
]

const vipTypeOptions = [
  { label: '普通免费用户 (Free)', value: 'free' },
  { label: '月度 VIP (30天)', value: 'vip_monthly' },
  { label: '半年 VIP (180天)', value: 'vip_half_year' },
  { label: '终身 VIP (永久)', value: 'vip_lifetime' },
]

// Select Options
const roleFilterOptions = [
  { label: '全部角色身份', value: 'all' },
  { label: '普通用户', value: '普通用户' },
  { label: 'VIP学员', value: 'VIP学员' },
  { label: '体验学员', value: '体验学员' },
  { label: '管理员', value: '管理员' },
]

const statusFilterOptions = [
  { label: '全部账号状态', value: 'all' },
  { label: '正常使用中', value: 'active' },
  { label: '已停用', value: 'disabled' },
]

const editRoleOptions = [
  { label: '普通用户', value: '普通用户' },
  { label: 'VIP学员', value: 'VIP学员' },
  { label: '体验学员', value: '体验学员' },
  { label: '管理员', value: '管理员' },
]

const editStatusOptions = [
  { label: '正常使用中 (Active)', value: 'active' },
  { label: '已停用 (Disabled)', value: 'disabled' },
]

// ----------------- User Detail Modal / Drawer State -----------------
const showDetailModal = ref(false)
const activeDetailUser = ref<AdminUserItem | null>(null)
const detailActiveTab = ref<'basic' | 'progress' | 'favorites' | 'reviews'>('basic')
const isLoadingDetail = ref(false)

const userProgressList = ref<UserProgressItem[]>([])
const userFavCourses = ref<UserFavoriteCourse[]>([])
const userFavSentences = ref<UserFavoriteSentence[]>([])
const favSubTab = ref<'courses' | 'sentences'>('courses')
const userReviewsList = ref<UserReviewItem[]>([])
const reviewSourceFilter = ref<'all' | 'error' | 'unfamiliar'>('all')

// ----------------- Add / Edit User Modal State -----------------
const showEditModal = ref(false)
const isSubmittingEdit = ref(false)
const editUserForm = ref({
  id: '',
  nickname: '',
  avatar: '',
  role: '普通用户',
  phone: '',
  email: '',
  status: 'active' as 'active' | 'banned' | 'disabled',
})

const showCreateModal = ref(false)
const isSubmittingCreate = ref(false)
const createUserForm = ref({
  nickname: '',
  avatar: '',
  role: '普通用户',
  phone: '',
  email: '',
  vipType: 'free' as VipType,
  vipExpireAt: '',
  status: 'active' as 'active' | 'banned' | 'disabled',
})

const createEstimatedExpireAt = computed(() => {
  if (createUserForm.value.vipExpireAt) return createUserForm.value.vipExpireAt
  return calculateVipExpiration(createUserForm.value.vipType, new Date())
})

// ----------------- Credential Card Modal (Temp Password & Reset Link) -----------------
const credentialCard = ref<{
  title: string
  email: string
  tempPassword: string
  resetLink: string
  emailStatus: string
} | null>(null)
const copiedCred = ref(false)

function copyCredential() {
  if (!credentialCard.value) return
  const text = `邮箱: ${credentialCard.value.email}\n临时密码: ${credentialCard.value.tempPassword}\n修改密码链接: ${credentialCard.value.resetLink}`
  navigator.clipboard.writeText(text)
  copiedCred.value = true
  setTimeout(() => { copiedCred.value = false }, 2000)
}

// ----------------- VIP Adjustment Modal -----------------
const showVipModal = ref(false)
const isSubmittingVip = ref(false)
const vipEditForm = ref({
  userId: '',
  nickname: '',
  currentVipType: 'free' as VipType,
  currentExpireAt: null as string | null,
  vipType: 'vip_monthly' as VipType,
  mode: 'from_now' as 'from_now' | 'extend',
  customExpireAt: '',
})

const vipEstimatedPreview = computed(() => {
  if (vipEditForm.value.customExpireAt.trim()) {
    return vipEditForm.value.customExpireAt.trim()
  }
  let baseDate = new Date()
  if (vipEditForm.value.mode === 'extend' && vipEditForm.value.currentExpireAt) {
    const existing = new Date(vipEditForm.value.currentExpireAt)
    if (!isNaN(existing.getTime()) && existing.getTime() > baseDate.getTime()) {
      baseDate = existing
    }
  }
  return calculateVipExpiration(vipEditForm.value.vipType, baseDate)
})

function openVipModal(user: AdminUserItem) {
  vipEditForm.value = {
    userId: user.id,
    nickname: user.nickname,
    currentVipType: user.vipType || 'free',
    currentExpireAt: user.vipExpireAt || null,
    vipType: (user.vipType && user.vipType !== 'free') ? user.vipType : 'vip_monthly',
    mode: 'from_now',
    customExpireAt: '',
  }
  showVipModal.value = true
}

async function submitVipUpdate() {
  isSubmittingVip.value = true
  try {
    const res = await adminFetch(`/api/admin/users/${vipEditForm.value.userId}/vip`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vipType: vipEditForm.value.vipType,
        mode: vipEditForm.value.mode,
        customExpireAt: vipEditForm.value.customExpireAt.trim() || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '调整失败')
    showVipModal.value = false
    await fetchUsers()
  } catch (err: any) {
    alert(`VIP 调整失败: ${err.message}`)
  } finally {
    isSubmittingVip.value = false
  }
}

// ----------------- Level / EXP Modal -----------------
const showLevelModal = ref(false)
const isSubmittingLevel = ref(false)
const levelEditForm = ref({
  userId: '',
  nickname: '',
  level: 1,
  exp: 0,
})

function openLevelModal(user: AdminUserItem) {
  levelEditForm.value = {
    userId: user.id,
    nickname: user.nickname,
    level: user.level || 1,
    exp: user.exp || 0,
  }
  showLevelModal.value = true
}

async function submitLevelUpdate() {
  isSubmittingLevel.value = true
  try {
    const res = await adminFetch(`/api/admin/users/${levelEditForm.value.userId}/level-exp`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: Number(levelEditForm.value.level),
        exp: Number(levelEditForm.value.exp),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '更新失败')
    showLevelModal.value = false
    await fetchUsers()
  } catch (err: any) {
    alert(`等级经验调整失败: ${err.message}`)
  } finally {
    isSubmittingLevel.value = false
  }
}

// ----------------- Reset 8-Char Password -----------------
async function handleResetPassword(user: AdminUserItem) {
  if (!confirm(`确定要将学员【${user.nickname}】的密码重置为随机 8 位临时密码，并发送邮件通知吗？`)) return
  try {
    const res = await adminFetch(`/api/admin/users/${user.id}/reset-password`, {
      method: 'POST',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '重置失败')
    credentialCard.value = {
      title: `已重置【${user.nickname}】的密码`,
      email: user.email || '未绑定邮箱',
      tempPassword: data.tempPassword,
      resetLink: data.resetLink,
      emailStatus: data.emailStatus || 'simulated',
    }
  } catch (err: any) {
    alert(`重置密码失败: ${err.message}`)
  }
}

// ----------------- Data Fetching -----------------
async function fetchUsers() {
  isLoading.value = true
  try {
    const params = new URLSearchParams()
    if (searchKeyword.value.trim()) params.append('keyword', searchKeyword.value.trim())
    if (selectedRole.value !== 'all') params.append('role', selectedRole.value)
    if (selectedStatus.value !== 'all') params.append('status', selectedStatus.value)
    if (selectedVipFilter.value !== 'all') params.append('vipFilter', selectedVipFilter.value)

    const res = await adminFetch(`/api/admin/users?${params.toString()}`)
    if (res.ok) {
      users.value = await res.json()
    }
  } catch (err) {
    console.error('Failed to fetch users:', err)
  } finally {
    isLoading.value = false
  }
}

// Open Detail Modal
async function openUserDetail(user: AdminUserItem, defaultTab: 'basic' | 'progress' | 'favorites' | 'reviews' = 'basic') {
  activeDetailUser.value = user
  detailActiveTab.value = defaultTab
  showDetailModal.value = true
  await loadUserDetailData(user.id)
}

async function loadUserDetailData(userId: string) {
  isLoadingDetail.value = true
  try {
    const [detailRes, progRes, favRes, revRes] = await Promise.all([
      adminFetch(`/api/admin/users/${userId}/detail`),
      adminFetch(`/api/admin/users/${userId}/progress`),
      adminFetch(`/api/admin/users/${userId}/favorites`),
      adminFetch(`/api/admin/users/${userId}/reviews`),
    ])

    if (detailRes.ok) {
      const detailData = await detailRes.json()
      if (detailData?.user && activeDetailUser.value) {
        Object.assign(activeDetailUser.value, detailData.user)
      }
    }
    if (progRes.ok) {
      userProgressList.value = await progRes.json()
    }
    if (favRes.ok) {
      const favData = await favRes.json()
      userFavCourses.value = favData.courses || []
      userFavSentences.value = favData.sentences || []
    }
    if (revRes.ok) {
      userReviewsList.value = await revRes.json()
    }
  } catch (err) {
    console.error('Failed to load user sub-records:', err)
  } finally {
    isLoadingDetail.value = false
  }
}

// Open Edit Modal
function openEditUserModal(user: AdminUserItem) {
  editUserForm.value = {
    id: user.id,
    nickname: user.nickname,
    avatar: user.avatar,
    role: user.role,
    phone: user.phone || '',
    email: user.email || '',
    status: user.status,
  }
  showEditModal.value = true
}

async function submitEditUser() {
  if (!editUserForm.value.nickname.trim()) {
    alert('用户昵称为必填项')
    return
  }
  isSubmittingEdit.value = true
  try {
    const res = await adminFetch(`/api/admin/users/${editUserForm.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editUserForm.value),
    })
    if (res.ok) {
      showEditModal.value = false
      await fetchUsers()
      if (activeDetailUser.value && activeDetailUser.value.id === editUserForm.value.id) {
        activeDetailUser.value.nickname = editUserForm.value.nickname
        activeDetailUser.value.role = editUserForm.value.role
        activeDetailUser.value.status = editUserForm.value.status
        activeDetailUser.value.phone = editUserForm.value.phone
        activeDetailUser.value.email = editUserForm.value.email
        activeDetailUser.value.avatar = editUserForm.value.avatar
      }
    } else {
      const err = await res.json()
      alert(`保存失败: ${err.error || '未知错误'}`)
    }
  } catch (err: any) {
    alert(`网络错误: ${err.message}`)
  } finally {
    isSubmittingEdit.value = false
  }
}

// Toggle user status
async function toggleUserStatus(user: AdminUserItem) {
  const newStatus = user.status === 'active' ? 'disabled' : 'active'
  const actionText = newStatus === 'active' ? '启用恢复' : '停用禁用'
  if (!confirm(`确定要${actionText}学员【${user.nickname}】(UID: ${user.id}) 吗？`)) return

  try {
    const res = await adminFetch(`/api/admin/users/${user.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      user.status = newStatus
      if (activeDetailUser.value && activeDetailUser.value.id === user.id) {
        activeDetailUser.value.status = newStatus
      }
    }
  } catch (err) {
    console.error('Failed to toggle status:', err)
  }
}

// Submit Create User
async function submitCreateUser() {
  if (!createUserForm.value.email.trim()) {
    alert('用户邮箱为必填项（将用于登录与发送临时密码）')
    return
  }
  isSubmittingCreate.value = true
  try {
    const res = await adminFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createUserForm.value,
        nickname: createUserForm.value.nickname.trim() || createUserForm.value.email.split('@')[0],
      }),
    })
    if (res.ok) {
      const data = await res.json()
      showCreateModal.value = false
      const createdEmail = createUserForm.value.email
      createUserForm.value = {
        nickname: '',
        avatar: '',
        role: '普通用户',
        phone: '',
        email: '',
        vipType: 'free',
        vipExpireAt: '',
        status: 'active',
      }
      await fetchUsers()
      if (data.tempPassword) {
        credentialCard.value = {
          title: '新账号创建成功（请保存或发送凭据）',
          email: createdEmail,
          tempPassword: data.tempPassword,
          resetLink: data.resetLink,
          emailStatus: data.emailStatus || 'simulated',
        }
      }
    } else {
      const err = await res.json()
      alert(`创建失败: ${err.error || '未知错误'}`)
    }
  } catch (err: any) {
    alert(`网络错误: ${err.message}`)
  } finally {
    isSubmittingCreate.value = false
  }
}

// Delete User
async function handleDeleteUser(user: AdminUserItem) {
  if (user.id === '8723192') {
    alert('初始默认管理员账户不可删除')
    return
  }
  if (!confirm(`⚠️ 危险操作：确定要彻底删除用户【${user.nickname}】(UID: ${user.id}) 吗？\n该用户的学习进度、收藏及错题复习本数据都将被一并清理！`)) {
    return
  }

  try {
    const res = await adminFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    if (res.ok) {
      if (showDetailModal.value && activeDetailUser.value?.id === user.id) {
        showDetailModal.value = false
      }
      await fetchUsers()
    } else {
      const err = await res.json()
      alert(`删除失败: ${err.error || '未知错误'}`)
    }
  } catch (err: any) {
    alert(`网络错误: ${err.message}`)
  }
}

// Helpers
function formatSeconds(secs: number) {
  if (!secs || secs <= 0) return '0分钟'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) {
    return `${h}小时${m > 0 ? `${m}分` : ''}`
  }
  return `${m || 1}分钟`
}

function formatDate(isoStr?: string) {
  if (!isoStr) return '--'
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return isoStr
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return isoStr
  }
}

function playTTS(text: string) {
  ttsService.speak({ text })
}

// Summary Metrics
const totalUserCount = computed(() => users.value.length)
const activeUserCount = computed(() => users.value.filter(u => u.status === 'active').length)
const vipUserCount = computed(() => users.value.filter(u => u.role.includes('VIP') || u.role.includes('会员')).length)
const totalPlatformSeconds = computed(() => users.value.reduce((acc, u) => acc + (u.totalStudySeconds || 0), 0))

// Filtered reviews
const filteredReviews = computed(() => {
  if (reviewSourceFilter.value === 'all') return userReviewsList.value
  return userReviewsList.value.filter(r => r.source === reviewSourceFilter.value)
})

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <div class="user-management-root space-y-6">
    <!-- Top Metric Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="user-stat-card p-4 rounded-2xl bg-[#141826] border border-[#252b41] flex items-center gap-3.5 shadow-sm">
        <div class="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
          <Users class="w-5 h-5" />
        </div>
        <div>
          <div class="text-[11px] text-slate-400 font-medium">全平台学员总数</div>
          <div class="text-xl font-bold text-white font-mono mt-0.5">{{ totalUserCount }} <span class="text-xs font-normal text-slate-400">人</span></div>
        </div>
      </div>

      <div class="user-stat-card p-4 rounded-2xl bg-[#141826] border border-[#252b41] flex items-center gap-3.5 shadow-sm">
        <div class="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <ShieldCheck class="w-5 h-5" />
        </div>
        <div>
          <div class="text-[11px] text-slate-400 font-medium">正常在读学员</div>
          <div class="text-xl font-bold text-emerald-400 font-mono mt-0.5">{{ activeUserCount }} <span class="text-xs font-normal text-slate-400">人</span></div>
        </div>
      </div>

      <div class="user-stat-card p-4 rounded-2xl bg-[#141826] border border-[#252b41] flex items-center gap-3.5 shadow-sm">
        <div class="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
          <Award class="w-5 h-5" />
        </div>
        <div>
          <div class="text-[11px] text-slate-400 font-medium">VIP/会员学员</div>
          <div class="text-xl font-bold text-amber-300 font-mono mt-0.5">{{ vipUserCount }} <span class="text-xs font-normal text-slate-400">人</span></div>
        </div>
      </div>

      <div class="user-stat-card p-4 rounded-2xl bg-[#141826] border border-[#252b41] flex items-center gap-3.5 shadow-sm">
        <div class="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
          <Clock class="w-5 h-5" />
        </div>
        <div>
          <div class="text-[11px] text-slate-400 font-medium">平台累计练习时长</div>
          <div class="text-xl font-bold text-cyan-300 font-mono mt-0.5">{{ formatSeconds(totalPlatformSeconds) }}</div>
        </div>
      </div>
    </div>

    <!-- Filter and Action Bar -->
    <div class="user-filter-bar p-4 rounded-2xl bg-[#141826] border border-[#252b41] flex flex-wrap items-center justify-between gap-3 shadow-sm">
      <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
        <!-- Search -->
        <div class="relative w-64">
          <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchKeyword"
            @keyup.enter="fetchUsers"
            placeholder="搜索昵称 / UID / 手机 / 邮箱"
            class="user-search-input w-full pl-9 pr-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <!-- Role Select -->
        <div class="w-40">
          <CustomSelect
            v-model="selectedRole"
            :options="roleFilterOptions"
            size="sm"
            @change="fetchUsers"
          />
        </div>

        <!-- Status Select -->
        <div class="w-36">
          <CustomSelect
            v-model="selectedStatus"
            :options="statusFilterOptions"
            size="sm"
            @change="fetchUsers"
          />
        </div>

        <!-- VIP Filter Select -->
        <div class="w-36">
          <CustomSelect
            v-model="selectedVipFilter"
            :options="vipFilterOptions"
            size="sm"
            @change="fetchUsers"
          />
        </div>

        <button
          @click="fetchUsers"
          class="user-query-btn px-3.5 py-2 rounded-xl bg-[#1e2438] hover:bg-[#28314d] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-[#2e3758]"
          title="根据当前过滤条件刷新列表"
        >
          <RotateCcw class="w-3.5 h-3.5" :class="isLoading ? 'animate-spin' : ''" />
          <span>查询</span>
        </button>
      </div>

      <!-- Right Add User Button -->
      <button
        @click="showCreateModal = true"
        class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer shrink-0"
      >
        <UserPlus class="w-4 h-4" />
        <span>添加新学员</span>
      </button>
    </div>

    <!-- Users Table -->
    <div class="user-table-card rounded-2xl bg-[#141826] border border-[#252b41] overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="user-table-thead bg-[#0e121f] border-b border-[#252b41] text-slate-400 font-semibold uppercase text-[11px] tracking-wider whitespace-nowrap">
            <tr>
              <th class="px-2.5 py-3 whitespace-nowrap">学员用户</th>
              <th class="px-1 py-3 text-center whitespace-nowrap">身份角色</th>
              <th class="px-1 py-3 text-center whitespace-nowrap">账号状态</th>
              <th class="px-1.5 py-3 whitespace-nowrap">练习投入</th>
              <th class="px-1.5 py-3 text-center whitespace-nowrap">综合学情</th>
              <th class="px-1.5 py-3 text-center whitespace-nowrap">连续打卡</th>
              <th class="px-1 py-3 text-center whitespace-nowrap">注册时间</th>
              <th class="px-2.5 py-3 text-left whitespace-nowrap">管理操作</th>
            </tr>
          </thead>
          <tbody class="user-table-tbody divide-y divide-[#1e2438] text-slate-200">
            <tr v-if="users.length === 0" class="text-center">
              <td colspan="8" class="py-12 text-slate-400">
                <div class="flex flex-col items-center gap-2">
                  <Users class="w-8 h-8 text-slate-500" />
                  <span>暂无匹配的学员数据</span>
                </div>
              </td>
            </tr>

            <tr
              v-for="u in users"
              :key="u.id"
              class="user-table-row hover:bg-[#181d2f] transition-colors"
            >
              <!-- Avatar & Nickname & UID & Phone -->
              <td class="px-2.5 py-2.5 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <div class="user-avatar-wrap w-8 h-8 rounded-full border border-[#2e3758] overflow-hidden bg-white p-0.5 shrink-0 flex items-center justify-center">
                    <img :src="u.avatar" :alt="u.nickname" class="w-full h-full rounded-full object-cover" />
                  </div>
                  <div>
                    <div class="user-name-title font-bold text-white flex items-center gap-1.5 whitespace-nowrap text-xs">
                      <span>{{ u.nickname }}</span>
                      <span class="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">Lv.{{ u.level || 1 }}</span>
                    </div>
                    <div class="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                      <span>UID: {{ u.id }}</span>
                      <span class="text-slate-600">|</span>
                      <span class="text-slate-300">{{ u.email || u.phone || '未绑定邮箱' }}</span>
                    </div>
                  </div>
                </div>
              </td>

              <!-- Role & VIP -->
              <td class="px-1 py-2.5 text-center whitespace-nowrap">
                <div class="flex flex-col items-center gap-1">
                  <span
                    v-if="u.isVipActive"
                    class="px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 border whitespace-nowrap bg-amber-500/15 text-amber-300 border-amber-500/40"
                  >
                    <Crown class="w-3 h-3" />
                    <span>{{ VIP_TYPE_INFO[u.vipType || 'free']?.label || 'VIP' }}</span>
                  </span>
                  <span
                    v-else-if="u.hasEverVip"
                    class="px-2 py-0.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1 border whitespace-nowrap bg-slate-700/40 text-slate-400 border-slate-600/40 grayscale"
                    title="VIP 已过期（徽章置灰保留）"
                  >
                    <Award class="w-3 h-3" />
                    <span>VIP已过期</span>
                  </span>
                  <span
                    v-else
                    class="px-2 py-0.5 rounded-md text-[11px] font-medium inline-block border whitespace-nowrap bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                  >
                    {{ u.role }}
                  </span>
                  <span v-if="u.isVipActive && u.vipType !== 'vip_lifetime' && u.vipExpireAt" class="text-[10px] text-amber-300/70 font-mono">
                    至 {{ u.vipExpireAt.slice(0, 10) }}
                  </span>
                </div>
              </td>

              <!-- Status -->
              <td class="px-1 py-2.5 text-center whitespace-nowrap">
                <span
                  :class="[
                    'px-1.5 py-0.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1 border whitespace-nowrap shrink-0',
                    u.status === 'active'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  ]"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    :class="u.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"
                  />
                  <span class="whitespace-nowrap">{{ u.status === 'active' ? '正常在学' : '已禁用' }}</span>
                </span>
              </td>

              <!-- Study Stats -->
              <td class="px-1.5 py-2.5 whitespace-nowrap">
                <div class="space-y-0.5 whitespace-nowrap">
                  <div class="font-bold text-cyan-400 font-mono text-xs whitespace-nowrap">{{ formatSeconds(u.totalStudySeconds) }}</div>
                  <div class="text-[11px] text-slate-400 font-mono whitespace-nowrap">累计完成 {{ u.totalSentenceCount }} 句</div>
                </div>
              </td>

              <!-- Summary Progress / Favs / Reviews -->
              <td class="px-1.5 py-2.5 text-center whitespace-nowrap">
                <div class="inline-flex items-center gap-1 whitespace-nowrap">
                  <button
                    @click="openUserDetail(u, 'progress')"
                    class="px-1.5 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[11px] font-mono border border-indigo-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title="在学课程数"
                  >
                    在学 {{ u.progressCount }}
                  </button>
                  <button
                    @click="openUserDetail(u, 'favorites')"
                    class="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-mono border border-amber-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title="收藏课程与精选句子"
                  >
                    收藏 {{ u.favCourseCount + u.favSentenceCount }}
                  </button>
                  <button
                    @click="openUserDetail(u, 'reviews')"
                    class="px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-mono border border-rose-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title="错题与复习本"
                  >
                    错题 {{ u.reviewCount }}
                  </button>
                </div>
              </td>

              <!-- Streak -->
              <td class="px-1.5 py-2.5 text-center whitespace-nowrap">
                <div
                  class="inline-flex items-center gap-1 font-mono font-bold whitespace-nowrap"
                  :class="u.hasCheckedInToday ? 'text-amber-400' : 'text-slate-400'"
                  :title="u.hasCheckedInToday ? `今日已打卡，已连续打卡 ${u.continuousDays} 天` : `今日尚未打卡 (已连续打卡 ${u.continuousDays} 天)`"
                >
                  <Flame
                    class="w-3.5 h-3.5 shrink-0"
                    :class="u.hasCheckedInToday ? 'fill-amber-400 text-amber-400' : 'text-slate-500'"
                  />
                  <span>{{ u.continuousDays }} 天</span>
                  <span
                    v-if="u.hasCheckedInToday"
                    class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-sm shadow-emerald-400/50"
                    title="今日已打卡"
                  />
                </div>
              </td>

              <!-- Created At -->
              <td class="px-1 py-2.5 text-center text-slate-400 font-mono text-[11px] whitespace-nowrap">
                {{ formatDate(u.createdAt) }}
              </td>

              <!-- Actions -->
              <td class="px-2.5 py-2.5 text-left whitespace-nowrap">
                <div class="flex items-center justify-start gap-1 whitespace-nowrap">
                  <!-- View Profile / Study Center -->
                  <button
                    @click="openUserDetail(u, 'basic')"
                    class="px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white font-medium text-[11px] flex items-center gap-1 transition-colors border border-indigo-500/30 cursor-pointer whitespace-nowrap shrink-0"
                    title="查看此学员完整学情档案"
                  >
                    <Eye class="w-3.5 h-3.5 shrink-0" />
                    <span class="whitespace-nowrap">学情档案</span>
                  </button>

                  <!-- Edit User -->
                  <button
                    @click="openEditUserModal(u)"
                    class="p-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 transition-colors cursor-pointer shrink-0"
                    title="编辑学员信息"
                  >
                    <Edit2 class="w-3.5 h-3.5 shrink-0" />
                  </button>

                  <!-- Adjust VIP -->
                  <button
                    @click="openVipModal(u)"
                    class="p-1 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 transition-colors cursor-pointer shrink-0"
                    title="调整 VIP 会员类型与有效期"
                  >
                    <Crown class="w-3.5 h-3.5 shrink-0" />
                  </button>

                  <!-- Adjust Level/EXP -->
                  <button
                    @click="openLevelModal(u)"
                    class="p-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 transition-colors cursor-pointer shrink-0"
                    title="调整等级与经验值"
                  >
                    <Sparkles class="w-3.5 h-3.5 shrink-0" />
                  </button>

                  <!-- Reset 8-char Password -->
                  <button
                    @click="handleResetPassword(u)"
                    class="p-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-colors cursor-pointer shrink-0"
                    title="重置为随机8位密码并发送邮件"
                  >
                    <KeyRound class="w-3.5 h-3.5 shrink-0" />
                  </button>

                  <!-- Toggle Status -->
                  <button
                    @click="toggleUserStatus(u)"
                    :class="[
                      'p-1 rounded-lg border transition-colors cursor-pointer shrink-0',
                      u.status === 'active'
                        ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    ]"
                    :title="u.status === 'active' ? '停用此用户' : '恢复此用户'"
                  >
                    <Ban v-if="u.status === 'active'" class="w-3.5 h-3.5 shrink-0" />
                    <ShieldCheck v-else class="w-3.5 h-3.5 shrink-0" />
                  </button>

                  <!-- Delete User -->
                  <button
                    @click="handleDeleteUser(u)"
                    class="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer shrink-0"
                    title="删除学员数据"
                  >
                    <Trash2 class="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: 用户全景学情与数据中心 (User Detail Center)                         -->
    <!-- ========================================================================= -->
    <div
      v-if="showDetailModal && activeDetailUser"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      @click.self="showDetailModal = false"
    >
      <div class="user-detail-modal w-full max-w-4xl h-[680px] max-h-[88vh] flex flex-col rounded-3xl bg-[#121626] border border-[#252b41] shadow-2xl overflow-hidden">
        <!-- Modal Top Profile Card -->
        <div class="user-detail-header p-6 bg-[#0c0e18] border-b border-[#22283e] flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div class="flex items-center gap-4">
            <div class="user-avatar-lg w-16 h-16 rounded-2xl border-2 border-indigo-500/40 p-1 bg-white overflow-hidden shrink-0 shadow-lg">
              <img :src="activeDetailUser.avatar" class="w-full h-full rounded-xl object-cover" />
            </div>
            <div>
              <div class="flex items-center gap-2.5">
                <h2 class="user-detail-title text-lg font-bold text-white">{{ activeDetailUser.nickname }}</h2>
                <span
                  :class="[
                    'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                    activeDetailUser.role.includes('VIP') ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  ]"
                >
                  {{ activeDetailUser.role }}
                </span>
                <span
                  :class="[
                    'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                    activeDetailUser.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  ]"
                >
                  {{ activeDetailUser.status === 'active' ? '正常在学' : '已禁用' }}
                </span>
              </div>
              <div class="flex items-center gap-4 text-xs text-slate-400 font-mono mt-1.5">
                <span>UID: {{ activeDetailUser.id }}</span>
                <span v-if="activeDetailUser.phone">电话: {{ activeDetailUser.phone }}</span>
                <span v-if="activeDetailUser.email">邮箱: {{ activeDetailUser.email }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              @click="openEditUserModal(activeDetailUser)"
              class="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 text-xs font-semibold border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit2 class="w-3.5 h-3.5" />
              <span>编辑资料</span>
            </button>
            <button
              @click="showDetailModal = false"
              class="user-detail-close-btn p-2 rounded-xl bg-[#1e2438] hover:bg-[#28314d] text-slate-400 hover:text-white border border-[#2e3758] transition-colors cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Detail Sub-Navigation Tabs -->
        <div class="user-detail-tabs flex items-center gap-2 px-6 pt-4 border-b border-[#22283e] bg-[#0e121f] shrink-0">
          <button
            @click="detailActiveTab = 'basic'"
            :class="[
              'px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border-b-2',
              detailActiveTab === 'basic'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            ]"
          >
            <Users class="w-4 h-4" />
            <span>基本资料 & 账号档案</span>
          </button>

          <button
            @click="detailActiveTab = 'progress'"
            :class="[
              'px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border-b-2',
              detailActiveTab === 'progress'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            ]"
          >
            <BookOpen class="w-4 h-4" />
            <span>学习进度与课程 ({{ userProgressList.length }})</span>
          </button>

          <button
            @click="detailActiveTab = 'favorites'"
            :class="[
              'px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border-b-2',
              detailActiveTab === 'favorites'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            ]"
          >
            <Bookmark class="w-4 h-4" />
            <span>我的收藏 ({{ userFavCourses.length + userFavSentences.length }})</span>
          </button>

          <button
            @click="detailActiveTab = 'reviews'"
            :class="[
              'px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border-b-2',
              detailActiveTab === 'reviews'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            ]"
          >
            <AlertTriangle class="w-4 h-4" />
            <span>复习本 / 错题集 ({{ userReviewsList.length }})</span>
          </button>
        </div>

        <!-- Detail Tab Contents -->
        <div class="user-detail-content p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
          <!-- ----------------------------------------------------------- -->
          <!-- 1. 基本资料 Tab                                             -->
          <!-- ----------------------------------------------------------- -->
          <div v-if="detailActiveTab === 'basic'" class="space-y-6">
            <!-- Stat overview row -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div class="user-sub-stat-card p-4 rounded-xl bg-[#141826] border border-[#252b41] space-y-1">
                <span class="text-[11px] text-slate-400">总累计学习时长</span>
                <div class="text-lg font-bold text-cyan-400 font-mono">{{ formatSeconds(activeDetailUser.totalStudySeconds) }}</div>
                <div class="text-[10px] text-slate-500">（本月用时: {{ formatSeconds(activeDetailUser.monthStudySeconds) }}）</div>
              </div>

              <div class="user-sub-stat-card p-4 rounded-xl bg-[#141826] border border-[#252b41] space-y-1">
                <span class="text-[11px] text-slate-400">累计刷句通关量</span>
                <div class="text-lg font-bold text-emerald-400 font-mono">{{ activeDetailUser.totalSentenceCount }} <span class="text-xs font-normal">句</span></div>
                <div class="text-[10px] text-slate-500">（今日完成: {{ activeDetailUser.todaySentenceCount }} 句）</div>
              </div>

              <div class="user-sub-stat-card p-4 rounded-xl bg-[#141826] border border-[#252b41] space-y-1">
                <span class="text-[11px] text-slate-400">连续打卡天数</span>
                <div class="text-lg font-bold text-amber-400 font-mono flex items-center gap-1">
                  <Flame class="w-4 h-4 fill-amber-400" />
                  <span>{{ activeDetailUser.continuousDays }} 天</span>
                </div>
                <div class="text-[10px] text-slate-500">高黏性学习状态</div>
              </div>

              <div class="user-sub-stat-card p-4 rounded-xl bg-[#141826] border border-[#252b41] space-y-1">
                <span class="text-[11px] text-slate-400">在学课程数</span>
                <div class="text-lg font-bold text-indigo-400 font-mono">{{ userProgressList.length }} <span class="text-xs font-normal">门</span></div>
                <div class="text-[10px] text-slate-500">累计收录错题 {{ userReviewsList.length }} 题</div>
              </div>
            </div>

            <!-- Profile Info Grid -->
            <div class="user-sub-profile-grid p-5 rounded-2xl bg-[#141826] border border-[#252b41] space-y-4">
              <h3 class="text-xs font-bold text-slate-200 tracking-wide uppercase">学员基础信息档案</h3>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span class="text-slate-400 block mb-1">系统用户 UID</span>
                  <span class="font-mono text-white font-bold">{{ activeDetailUser.id }}</span>
                </div>
                <div>
                  <span class="text-slate-400 block mb-1">用户昵称</span>
                  <span class="text-white font-semibold">{{ activeDetailUser.nickname }}</span>
                </div>
                <div>
                  <span class="text-slate-400 block mb-1">学员角色级别</span>
                  <span class="text-indigo-400 font-semibold">{{ activeDetailUser.role }}</span>
                </div>
                <div>
                  <span class="text-slate-400 block mb-1">绑定的手机号码</span>
                  <span class="font-mono text-slate-200">{{ activeDetailUser.phone || '未绑定手机' }}</span>
                </div>
                <div>
                  <span class="text-slate-400 block mb-1">联系电子邮箱</span>
                  <span class="font-mono text-slate-200">{{ activeDetailUser.email || '未绑定邮箱' }}</span>
                </div>
                <div>
                  <span class="text-slate-400 block mb-1">账号使用状态</span>
                  <span :class="activeDetailUser.status === 'active' ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'">
                    {{ activeDetailUser.status === 'active' ? '正常在学 (Active)' : '已停用禁用 (Banned)' }}
                  </span>
                </div>
                <div>
                  <span class="text-slate-400 block mb-1">初次注册入库时间</span>
                  <span class="font-mono text-slate-300">{{ formatDate(activeDetailUser.createdAt) }}</span>
                </div>
                <div>
                  <span class="text-slate-400 block mb-1">最近档案更新时间</span>
                  <span class="font-mono text-slate-300">{{ formatDate(activeDetailUser.updatedAt) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ----------------------------------------------------------- -->
          <!-- 2. 学习进度与课程 Tab                                       -->
          <!-- ----------------------------------------------------------- -->
          <div v-else-if="detailActiveTab === 'progress'" class="space-y-4">
            <div v-if="userProgressList.length === 0" class="py-12 text-center text-slate-400">
              <BookOpen class="w-10 h-10 mx-auto text-slate-500 mb-2" />
              <p>该学员暂未开始任何课程的学习与练习</p>
            </div>

            <div
              v-for="prog in userProgressList"
              :key="prog.id"
              class="user-prog-card p-4 rounded-2xl bg-[#141826] border border-[#252b41] flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div class="flex items-center gap-3.5 flex-1 min-w-[240px]">
                <img
                  :src="prog.courseCover || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&q=80'"
                  class="w-16 h-12 rounded-xl object-cover border border-[#252b41] shrink-0"
                />
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-semibold border"
                      :class="prog.courseType === 'teaching' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'"
                    >
                      {{ prog.courseType === 'teaching' ? '同步教辅' : '核心课程' }}
                    </span>
                    <h4 class="font-bold text-white text-xs">{{ prog.courseTitle }}</h4>
                  </div>
                  <div class="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>当前驻留小节：<strong class="text-slate-200">{{ prog.lessonTitle }}</strong></span>
                  </div>
                </div>
              </div>

              <!-- Progress Bar & Study Duration -->
              <div class="flex items-center gap-6 w-full md:w-72 shrink-0">
                <div class="flex-1 space-y-1">
                  <div class="flex justify-between text-[11px] font-mono">
                    <span class="text-slate-400">综合进度</span>
                    <span class="text-indigo-400 font-bold">{{ prog.progressPercent }}%</span>
                  </div>
                  <div class="w-full h-2 rounded-full bg-[#0c0e18] overflow-hidden">
                    <div
                      class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                      :style="{ width: `${prog.progressPercent}%` }"
                    />
                  </div>
                </div>

                <div class="text-right shrink-0">
                  <div class="text-[11px] text-slate-400">该课程已学</div>
                  <div class="font-mono text-cyan-400 font-bold text-xs">{{ formatSeconds(prog.studySeconds) }}</div>
                  <div class="text-[10px] text-slate-500 font-mono mt-0.5">{{ formatDate(prog.lastPracticedAt) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- ----------------------------------------------------------- -->
          <!-- 3. 我的收藏 Tab                                             -->
          <!-- ----------------------------------------------------------- -->
          <div v-else-if="detailActiveTab === 'favorites'" class="space-y-4">
            <!-- Sub tabs: Courses vs Sentences -->
            <div class="flex items-center gap-2 border-b border-[#252b41] pb-2">
              <button
                @click="favSubTab = 'courses'"
                :class="[
                  'px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                  favSubTab === 'courses' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                ]"
              >
                收藏的课程与教材 ({{ userFavCourses.length }})
              </button>
              <button
                @click="favSubTab = 'sentences'"
                :class="[
                  'px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                  favSubTab === 'sentences' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                ]"
              >
                收藏的精选句子 ({{ userFavSentences.length }})
              </button>
            </div>

            <!-- Favorite Courses -->
            <div v-if="favSubTab === 'courses'" class="space-y-3">
              <div v-if="userFavCourses.length === 0" class="py-12 text-center text-slate-400">
                <Bookmark class="w-10 h-10 mx-auto text-slate-500 mb-2" />
                <p>该学员暂未收藏任何课程或教材</p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  v-for="fc in userFavCourses"
                  :key="fc.favId"
                  class="user-fav-course-card p-3.5 rounded-2xl bg-[#141826] border border-[#252b41] flex items-center gap-3"
                >
                  <img :src="fc.cover" class="w-16 h-12 rounded-xl object-cover border border-[#252b41] shrink-0" />
                  <div class="flex-1 min-w-0">
                    <h5 class="text-xs font-bold text-white truncate">{{ fc.title }}</h5>
                    <div class="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>讲师: {{ fc.instructorName }}</span>
                      <span>·</span>
                      <span class="font-mono">{{ fc.lessonCount }} 小节</span>
                    </div>
                    <div class="text-[10px] text-slate-500 font-mono mt-1">
                      收藏于: {{ formatDate(fc.favoritedAt) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Favorite Sentences -->
            <div v-else class="space-y-3">
              <div v-if="userFavSentences.length === 0" class="py-12 text-center text-slate-400">
                <Bookmark class="w-10 h-10 mx-auto text-slate-500 mb-2" />
                <p>该学员暂未收藏任何句子</p>
              </div>

              <div
                v-for="fs in userFavSentences"
                :key="fs.id"
                class="user-fav-sentence-card p-4 rounded-2xl bg-[#141826] border border-[#252b41] flex items-center justify-between gap-4"
              >
                <div class="space-y-1">
                  <div class="text-xs font-bold text-white tracking-wide">{{ fs.sentenceEn }}</div>
                  <div v-if="fs.phonetic" class="text-[11px] text-amber-300/80 font-mono">/{{ fs.phonetic }}/</div>
                  <div class="text-xs text-slate-300">{{ fs.sentenceCn }}</div>
                  <div class="text-[10px] text-slate-500 font-mono">
                    来源: {{ fs.courseTitle || '练习句子' }} · {{ formatDate(fs.createdAt) }}
                  </div>
                </div>

                <button
                  @click="playTTS(fs.sentenceEn)"
                  class="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="朗读句子发音"
                >
                  <Volume2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- ----------------------------------------------------------- -->
          <!-- 4. 复习本 / 错题集 Tab                                      -->
          <!-- ----------------------------------------------------------- -->
          <div v-else-if="detailActiveTab === 'reviews'" class="space-y-4">
            <!-- Filter by Source -->
            <div class="flex items-center justify-between gap-2 border-b border-[#252b41] pb-2">
              <div class="flex items-center gap-2">
                <button
                  @click="reviewSourceFilter = 'all'"
                  :class="[
                    'px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                    reviewSourceFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  ]"
                >
                  全量记录 ({{ userReviewsList.length }})
                </button>
                <button
                  @click="reviewSourceFilter = 'error'"
                  :class="[
                    'px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                    reviewSourceFilter === 'error' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  ]"
                >
                  练习错题 ({{ userReviewsList.filter(r => r.source === 'error').length }})
                </button>
                <button
                  @click="reviewSourceFilter = 'unfamiliar'"
                  :class="[
                    'px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                    reviewSourceFilter === 'unfamiliar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  ]"
                >
                  不熟悉收录 ({{ userReviewsList.filter(r => r.source === 'unfamiliar').length }})
                </button>
              </div>

              <div class="text-xs text-slate-400 font-mono">
                已掌握: <span class="text-emerald-400 font-bold">{{ userReviewsList.filter(r => r.isLearned).length }}</span> / 复习中: <span class="text-indigo-400 font-bold">{{ userReviewsList.filter(r => !r.isLearned).length }}</span>
              </div>
            </div>

            <div v-if="filteredReviews.length === 0" class="py-12 text-center text-slate-400">
              <CheckCircle2 class="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <p>暂无错题记录，学员掌握状态极佳！</p>
            </div>

            <div class="space-y-3">
              <div
                v-for="rev in filteredReviews"
                :key="rev.id"
                class="user-review-card p-4 rounded-2xl bg-[#141826] border border-[#252b41] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div class="space-y-1.5 flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-semibold border"
                      :class="rev.source === 'error' ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'"
                    >
                      {{ rev.source === 'error' ? `练习错题 (${rev.errorCount}次)` : '不熟悉收录' }}
                    </span>
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-semibold border"
                      :class="rev.isLearned ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'"
                    >
                      {{ rev.isLearned ? '已学会' : '复习中' }}
                    </span>
                    <span class="text-[11px] text-slate-400 font-mono truncate">{{ rev.courseTitle }}</span>
                  </div>

                  <div class="text-xs font-bold text-white tracking-wide">{{ rev.sentenceEn }}</div>
                  <div v-if="rev.phonetic" class="text-[11px] text-amber-300/80 font-mono">/{{ rev.phonetic }}/</div>
                  <div class="text-xs text-slate-300">{{ rev.sentenceCn }}</div>
                  <div class="text-[10px] text-slate-500 font-mono">{{ formatDate(rev.createdAt) }}</div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <button
                    @click="playTTS(rev.sentenceEn)"
                    class="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 hover:text-white transition-colors cursor-pointer"
                    title="播放发音"
                  >
                    <Volume2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: 编辑用户资料 (Edit User Modal)                                      -->
    <!-- ========================================================================= -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      @click.self="showEditModal = false"
    >
      <div class="user-form-modal-card w-full max-w-lg rounded-3xl bg-[#121626] border border-[#252b41] shadow-2xl p-6 space-y-5">
        <div class="user-form-modal-header flex items-center justify-between border-b border-[#22283e] pb-3">
          <div class="flex items-center gap-2">
            <Edit2 class="w-4 h-4 text-indigo-400" />
            <h3 class="user-form-modal-title text-sm font-bold text-white">编辑学员基础档案</h3>
          </div>
          <button @click="showEditModal = false" class="user-form-modal-close text-slate-400 hover:text-white cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-4 text-xs">
          <div>
            <label class="user-form-modal-label block text-slate-400 mb-1">学员 UID</label>
            <input
              :value="editUserForm.id"
              disabled
              class="user-form-modal-disabled w-full px-3 py-2 rounded-xl bg-[#0a0c14] border border-[#252b41] text-slate-400 font-mono cursor-not-allowed"
            />
          </div>

          <div>
            <label class="user-form-modal-label block text-slate-400 mb-1">学员昵称 <span class="text-rose-400">*</span></label>
            <input
              v-model="editUserForm.nickname"
              placeholder="请输入学员昵称"
              class="user-form-modal-input w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="user-form-modal-label block text-slate-400 mb-1">身份角色</label>
              <CustomSelect
                v-model="editUserForm.role"
                :options="editRoleOptions"
              />
            </div>
            <div>
              <label class="user-form-modal-label block text-slate-400 mb-1">账号状态</label>
              <CustomSelect
                v-model="editUserForm.status"
                :options="editStatusOptions"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="user-form-modal-label block text-slate-400 mb-1">联系手机</label>
              <input
                v-model="editUserForm.phone"
                placeholder="例如: 13800138000"
                class="user-form-modal-input w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label class="user-form-modal-label block text-slate-400 mb-1">联系邮箱</label>
              <input
                v-model="editUserForm.email"
                placeholder="例如: user@example.com"
                class="user-form-modal-input w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label class="user-form-modal-label block text-slate-400 mb-1">头像图片 URL</label>
            <input
              v-model="editUserForm.avatar"
              placeholder="https://..."
              class="user-form-modal-input w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
            />
          </div>
        </div>

        <div class="user-form-modal-footer flex items-center justify-end gap-3 pt-3 border-t border-[#22283e]">
          <button
            @click="showEditModal = false"
            class="user-form-modal-cancel px-4 py-2 rounded-xl bg-[#1e2438] text-slate-300 text-xs font-semibold hover:bg-[#28314d] transition-colors cursor-pointer border border-[#2e3758]"
          >
            取消
          </button>
          <button
            @click="submitEditUser"
            :disabled="isSubmittingEdit"
            class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {{ isSubmittingEdit ? '正在保存...' : '确认保存修改' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: 添加新学员 (Create User Modal)                                      -->
    <!-- ========================================================================= -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      @click.self="showCreateModal = false"
    >
      <div class="user-form-modal-card w-full max-w-lg rounded-3xl bg-[#121626] border border-[#252b41] shadow-2xl p-6 space-y-5">
        <div class="user-form-modal-header flex items-center justify-between border-b border-[#22283e] pb-3">
          <div class="flex items-center gap-2">
            <UserPlus class="w-4 h-4 text-indigo-400" />
            <h3 class="user-form-modal-title text-sm font-bold text-white">录入并添加新学员</h3>
          </div>
          <button @click="showCreateModal = false" class="user-form-modal-close text-slate-400 hover:text-white cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-4 text-xs">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="user-form-modal-label block text-slate-400 mb-1">登录邮箱 <span class="text-rose-400">*</span></label>
              <input
                v-model="createUserForm.email"
                type="email"
                placeholder="user@example.com"
                class="user-form-modal-input w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label class="user-form-modal-label block text-slate-400 mb-1">学员昵称（留空默认取邮箱前缀）</label>
              <input
                v-model="createUserForm.nickname"
                placeholder="例如: 李雷 🎓"
                class="user-form-modal-input w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="user-form-modal-label block text-slate-400 mb-1">VIP 会员类型</label>
              <CustomSelect
                v-model="createUserForm.vipType"
                :options="vipTypeOptions"
              />
            </div>
            <div>
              <label class="user-form-modal-label block text-slate-400 mb-1">初始账号状态</label>
              <CustomSelect
                v-model="createUserForm.status"
                :options="editStatusOptions"
              />
            </div>
          </div>

          <div v-if="createUserForm.vipType !== 'free'" class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-amber-300">预计终止时间：</span>
              <span class="font-mono font-bold text-amber-200">
                {{ createUserForm.vipType === 'vip_lifetime' ? '永久有效 (终身 VIP)' : (createEstimatedExpireAt || '-') }}
              </span>
            </div>
            <div v-if="createUserForm.vipType !== 'vip_lifetime'">
              <label class="block text-[11px] text-slate-400 mb-1">手动覆盖终止时间（可选，ISO 或 YYYY-MM-DD HH:mm:ss）</label>
              <input
                v-model="createUserForm.vipExpireAt"
                placeholder="留空则按所选类型自动计算"
                class="w-full px-2.5 py-1.5 rounded-lg bg-[#0e121f] border border-[#252b41] text-white text-[11px] font-mono outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label class="user-form-modal-label block text-slate-400 mb-1">联系手机（可选）</label>
            <input
              v-model="createUserForm.phone"
              placeholder="13800000000"
              class="user-form-modal-input w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <p class="text-[11px] text-slate-400 bg-[#0e121f] border border-[#252b41] rounded-xl px-3 py-2">
            系统将自动生成 <strong class="text-white">8 位随机临时密码</strong> 与 <strong class="text-white">24小时改密链接</strong> 并发送至用户邮箱。
          </p>
        </div>

        <div class="user-form-modal-footer flex items-center justify-end gap-3 pt-3 border-t border-[#22283e]">
          <button
            @click="showCreateModal = false"
            class="user-form-modal-cancel px-4 py-2 rounded-xl bg-[#1e2438] text-slate-300 text-xs font-semibold hover:bg-[#28314d] transition-colors cursor-pointer border border-[#2e3758]"
          >
            取消
          </button>
          <button
            @click="submitCreateUser"
            :disabled="isSubmittingCreate"
            class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {{ isSubmittingCreate ? '正在创建...' : '创建并发送凭证邮件' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: 新建/重置密码凭据卡片 (Credential Card Modal)                      -->
    <!-- ========================================================================= -->
    <div
      v-if="credentialCard"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      @click.self="credentialCard = null"
    >
      <div class="w-full max-w-md rounded-2xl bg-[#141826] border border-emerald-500/30 shadow-2xl p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-[#22283e] pb-3">
          <h3 class="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <CheckCircle2 class="w-4 h-4" />
            <span>{{ credentialCard.title }}</span>
          </h3>
          <button @click="credentialCard = null" class="text-slate-400 hover:text-white cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-2.5 text-xs bg-[#0e121f] border border-[#252b41] rounded-xl p-4">
          <div class="flex justify-between">
            <span class="text-slate-400">用户邮箱：</span>
            <span class="font-mono text-white">{{ credentialCard.email }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">8位临时密码：</span>
            <span class="font-mono font-bold text-amber-300 text-sm">{{ credentialCard.tempPassword }}</span>
          </div>
          <div class="pt-1 border-t border-[#1e2438]">
            <div class="text-slate-400 mb-1">改密链接（24小时有效）：</div>
            <div class="font-mono text-[11px] text-indigo-300 break-all">{{ credentialCard.resetLink }}</div>
          </div>
          <div class="pt-1 flex justify-between text-[11px]">
            <span class="text-slate-400">邮件发送状态：</span>
            <span :class="credentialCard.emailStatus === 'sent' ? 'text-emerald-400' : 'text-amber-400'">
              {{ credentialCard.emailStatus === 'sent' ? '已通过 SMTP 发出' : '已写入模拟发信箱（未启用真实SMTP）' }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="copyCredential"
            class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check v-if="copiedCred" class="w-3.5 h-3.5" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ copiedCred ? '已复制全部凭据' : '一键复制凭据' }}</span>
          </button>
          <button
            @click="credentialCard = null"
            class="px-4 py-2.5 rounded-xl bg-[#1e2438] text-slate-300 text-xs font-semibold cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: 调整 VIP 会员类型与有效期 (VIP Adjustment Modal)                   -->
    <!-- ========================================================================= -->
    <div
      v-if="showVipModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      @click.self="showVipModal = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-[#121626] border border-amber-500/30 shadow-2xl p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-[#22283e] pb-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <Crown class="w-4 h-4 text-amber-400" />
            <span>调整会员权益 · {{ vipEditForm.nickname }}</span>
          </h3>
          <button @click="showVipModal = false" class="text-slate-400 hover:text-white cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">目标会员类型</label>
            <CustomSelect v-model="vipEditForm.vipType" :options="vipTypeOptions" />
          </div>

          <div v-if="vipEditForm.vipType !== 'free' && vipEditForm.vipType !== 'vip_lifetime'">
            <label class="block text-slate-400 mb-1">时长计算方式</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                @click="vipEditForm.mode = 'from_now'"
                :class="[
                  'py-2 rounded-xl border text-xs font-semibold cursor-pointer',
                  vipEditForm.mode === 'from_now'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-[#0e121f] border-[#252b41] text-slate-400'
                ]"
              >
                从当前时间起算
              </button>
              <button
                type="button"
                @click="vipEditForm.mode = 'extend'"
                :class="[
                  'py-2 rounded-xl border text-xs font-semibold cursor-pointer',
                  vipEditForm.mode === 'extend'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-[#0e121f] border-[#252b41] text-slate-400'
                ]"
              >
                在原到期时间顺延
              </button>
            </div>
          </div>

          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
            <span class="text-amber-300">预计终止时间：</span>
            <span class="font-mono font-bold text-amber-200">
              {{
                vipEditForm.vipType === 'free'
                  ? '立即恢复普通用户'
                  : vipEditForm.vipType === 'vip_lifetime'
                  ? '永久有效 (终身 VIP)'
                  : (vipEstimatedPreview || '-')
              }}
            </span>
          </div>

          <div v-if="vipEditForm.vipType !== 'free' && vipEditForm.vipType !== 'vip_lifetime'">
            <label class="block text-slate-400 mb-1">手动调整终止时间（可选覆盖）</label>
            <input
              v-model="vipEditForm.customExpireAt"
              placeholder="例如: 2026-12-31T23:59:59Z"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white font-mono text-[11px] outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#22283e]">
          <button @click="showVipModal = false" class="px-4 py-2 rounded-xl bg-[#1e2438] text-slate-300 text-xs cursor-pointer">
            取消
          </button>
          <button
            @click="submitVipUpdate"
            :disabled="isSubmittingVip"
            class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
          >
            {{ isSubmittingVip ? '保存中...' : '确认更新 VIP' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: 调整等级与经验值 (Level / EXP Modal)                              -->
    <!-- ========================================================================= -->
    <div
      v-if="showLevelModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      @click.self="showLevelModal = false"
    >
      <div class="w-full max-w-sm rounded-2xl bg-[#121626] border border-purple-500/30 shadow-2xl p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-[#22283e] pb-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles class="w-4 h-4 text-purple-400" />
            <span>调整等级与经验 · {{ levelEditForm.nickname }}</span>
          </h3>
          <button @click="showLevelModal = false" class="text-slate-400 hover:text-white cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">等级 (1 - 30)</label>
            <input
              v-model.number="levelEditForm.level"
              type="number"
              min="1"
              max="30"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white font-mono outline-none focus:border-purple-400"
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">总经验值 (EXP)</label>
            <input
              v-model.number="levelEditForm.exp"
              type="number"
              min="0"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white font-mono outline-none focus:border-purple-400"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#22283e]">
          <button @click="showLevelModal = false" class="px-4 py-2 rounded-xl bg-[#1e2438] text-slate-300 text-xs cursor-pointer">
            取消
          </button>
          <button
            @click="submitLevelUpdate"
            :disabled="isSubmittingLevel"
            class="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer"
          >
            {{ isSubmittingLevel ? '保存中...' : '确认调整' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
