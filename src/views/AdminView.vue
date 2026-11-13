<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { importerService, type ParseResult } from '../services/importerService'
import { ttsService } from '../services/ttsService'
import { useCourseStore } from '../stores/courseStore'
import { adminFetch, getAdminInfo, clearAdminSession } from '../utils/adminApi'
import type { CourseItem, LessonItem, SchoolLevel } from '../types'
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  BookA,
  Settings,
  Plus,
  Trash2,
  Volume2,
  GraduationCap,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  ListOrdered,
  Eye,
  Edit3,
  Layers,
  Users,
  RefreshCw,
  Mail,
  ShieldCheck,
  KeyRound,
  LogOut,
} from 'lucide-vue-next'
import CategoryManagement from '../components/admin/CategoryManagement.vue'
import UserManagement from '../components/admin/UserManagement.vue'
import CourseSyncManager from '../components/admin/CourseSyncManager.vue'
import AdminSmtpPanel from '../components/admin/AdminSmtpPanel.vue'
import AdminAuditPanel from '../components/admin/AdminAuditPanel.vue'
import AdminVipRequestsPanel from '../components/admin/AdminVipRequestsPanel.vue'
import CustomSelect from '../components/common/CustomSelect.vue'
import type { CourseCategoryItem, SchoolLevelItem } from '../types'

const router = useRouter()
const courseStore = useCourseStore()
const adminInfo = ref(getAdminInfo())

// Admin change password modal
const showAdminPwdModal = ref(false)
const adminOldPwd = ref('')
const adminNewPwd = ref('')
const adminConfirmPwd = ref('')
const adminPwdMsg = ref('')
const adminPwdErr = ref('')
const adminPwdLoading = ref(false)

async function submitAdminChangePassword() {
  adminPwdErr.value = ''
  adminPwdMsg.value = ''
  if (!adminOldPwd.value || !adminNewPwd.value) {
    adminPwdErr.value = '请填写原密码和新密码'
    return
  }
  if (adminNewPwd.value.length < 8) {
    adminPwdErr.value = '管理员新密码长度不能少于 8 位'
    return
  }
  if (adminNewPwd.value !== adminConfirmPwd.value) {
    adminPwdErr.value = '两次输入的新密码不一致'
    return
  }
  adminPwdLoading.value = true
  try {
    const res = await adminFetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword: adminOldPwd.value, newPassword: adminNewPwd.value }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '修改失败')
    adminPwdMsg.value = '管理员密码修改成功！'
    adminOldPwd.value = ''
    adminNewPwd.value = ''
    adminConfirmPwd.value = ''
    setTimeout(() => {
      showAdminPwdModal.value = false
      adminPwdMsg.value = ''
    }, 1200)
  } catch (err: any) {
    adminPwdErr.value = err.message
  } finally {
    adminPwdLoading.value = false
  }
}

function handleAdminLogout() {
  clearAdminSession()
  router.push('/admin/login')
}

type AdminTab = 'course_square' | 'teaching_square' | 'categories' | 'users' | 'vip_requests' | 'sync' | 'dictionary' | 'engine' | 'smtp' | 'audit'
const activeTab = ref<AdminTab>('course_square')

const adminCourseCategories = ref<CourseCategoryItem[]>([])
const adminTeachingLevels = ref<SchoolLevelItem[]>([])

const courseCategorySelectOptions = computed(() => {
  return adminCourseCategories.value.map(cat => ({
    label: `${cat.name} (${cat.catKey})`,
    value: cat.catKey,
  }))
})

const teachingLevelSelectOptions = computed(() => {
  return adminTeachingLevels.value.map(lvl => ({
    label: `${lvl.name} (${lvl.levelKey})`,
    value: lvl.levelKey,
  }))
})

const newTeachingGradeSelectOptions = computed(() => {
  const currentLvl = adminTeachingLevels.value.find(l => l.levelKey === newTeaching.value.schoolLevel)
  return (currentLvl?.grades || []).map(g => ({
    label: `${g.name} (grade=${g.gradeValue})`,
    value: g.gradeValue,
  }))
})

const editTeachingGradeSelectOptions = computed(() => {
  const currentLvl = adminTeachingLevels.value.find(l => l.levelKey === editCourseData.value.schoolLevel)
  return (currentLvl?.grades || []).map(g => ({
    label: `${g.name} (grade=${g.gradeValue})`,
    value: g.gradeValue,
  }))
})

async function fetchAdminCategories() {
  try {
    const [cRes, tRes] = await Promise.all([
      fetch('/api/categories/courses'),
      fetch('/api/categories/teaching')
    ])
    if (cRes.ok) adminCourseCategories.value = await cRes.json()
    if (tRes.ok) adminTeachingLevels.value = await tRes.json()
  } catch (err) {
    console.error('Failed to load admin categories:', err)
  }
}

// ----------------- Course Square State -----------------
const selectedCourseId = ref<string>('')
const showCreateCourseModal = ref(false)
const newCourse = ref({
  title: '',
  category: 'intro',
  instructorName: 'Lucas',
  lessonCount: 0,
  cover: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&q=80',
  orderNum: 1,
})

// ----------------- Teaching Material Square State -----------------
const selectedTeachingId = ref<string>('')
const showCreateTeachingModal = ref(false)
const newTeaching = ref({
  title: '',
  schoolLevel: 'primary' as SchoolLevel,
  grade: 3,
  instructorName: 'Stella',
  lessonCount: 0,
  cover: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80',
  orderNum: 1,
})

// ----------------- Section Management State (For Currently Selected Course/Material) -----------------
const courseLessons = ref<LessonItem[]>([])
const isLoadingLessons = ref(false)
const expandedLessonId = ref<string | null>(null)
const lessonDetailsCache = ref<Record<string, LessonItem>>({})

// ----------------- Section Direct TXT Importer State -----------------
const activeImportLessonId = ref<string | null>(null)
const sectionTxtInput = ref('')
const sectionParseResult = ref<ParseResult | null>(null)
const sectionDurationSeconds = ref<number>(120)
const sectionRecommendedSeconds = ref<number>(120)
const sectionImportSuccessMsg = ref('')
const isImportingToSection = ref(false)

// Sample TXT templates
const sampleCourseTxt = `1|What's up?|1:What's:什么:wʌts;2:up:最近咋样:ʌp;
2|Good morning!|1:Good:好的:ɡʊd;2:morning:早晨:ˈmɔːnɪŋ;
3|Have a nice day!|1:Have:拥有:hæv;2:a:一个:ə;3:nice:美好的:naɪs;4:day:日子:deɪ;`

const sampleTeachingTxt = `1|Look at the blackboard.|1:Look:看:lʊk;2:at:在:æt;3:the:这:ðə;4:blackboard:黑板:ˈblækbɔːd;
2|Open your book.|1:Open:打开:ˈəʊpən;2:your:你的:jɔː;3:book:书:bʊk;
3|Clean the desk.|1:Clean:打扫:kliːn;2:the:这:ðə;3:desk:课桌:dɛsk;`

// ----------------- Section Create & Edit Modals State -----------------
const showCreateLessonModal = ref(false)
const newLesson = ref({
  lessonNumber: 1,
  titleEn: '',
  titleCn: '',
  practiceTimeSeconds: 120,
  txtContent: '',
})
const isCreatingLesson = ref(false)

const showEditLessonModal = ref(false)
const editLesson = ref({
  id: '',
  lessonNumber: 1,
  titleEn: '',
  titleCn: '',
  practiceTimeSeconds: 120,
})
const isUpdatingLesson = ref(false)

// ----------------- TTS Dictionary State -----------------
interface DictItem {
  id: string
  word: string
  spokenAlias: string
  ipa: string
}
const dictionaryItems = ref<DictItem[]>([])
const newWord = ref('')
const newAlias = ref('')
const newIpa = ref('')

// ----------------- Loaders & Lifecycle -----------------
onMounted(async () => {
  await courseStore.fetchCourses()
  await loadDictionary()
  await fetchAdminCategories()

  if (activeTab.value === 'course_square') {
    if (courseStore.courses.length > 0) {
      await selectCourse(courseStore.courses[0].id)
    }
    if (courseStore.teachingMaterials.length > 0) {
      selectedTeachingId.value = courseStore.teachingMaterials[0].id
    }
  } else if (activeTab.value === 'teaching_square') {
    if (courseStore.teachingMaterials.length > 0) {
      await selectTeaching(courseStore.teachingMaterials[0].id)
    }
    if (courseStore.courses.length > 0) {
      selectedCourseId.value = courseStore.courses[0].id
    }
  }
})

// Switch between course square and teaching square
watch(activeTab, async (tab) => {
  if (tab === 'course_square') {
    const targetId = selectedCourseId.value || (courseStore.courses[0] ? courseStore.courses[0].id : '')
    if (targetId) {
      await selectCourse(targetId)
    }
  } else if (tab === 'teaching_square') {
    const targetId = selectedTeachingId.value || (courseStore.teachingMaterials[0] ? courseStore.teachingMaterials[0].id : '')
    if (targetId) {
      await selectTeaching(targetId)
    }
  }
})

async function selectCourse(cId: string) {
  selectedCourseId.value = cId
  expandedLessonId.value = null
  activeImportLessonId.value = null
  sectionImportSuccessMsg.value = ''
  await loadCourseLessons(cId)
}

async function selectTeaching(tId: string) {
  selectedTeachingId.value = tId
  expandedLessonId.value = null
  activeImportLessonId.value = null
  sectionImportSuccessMsg.value = ''
  await loadCourseLessons(tId)
}

async function loadCourseLessons(courseId: string) {
  if (!courseId) {
    courseLessons.value = []
    return
  }
  try {
    isLoadingLessons.value = true
    const lessons = await courseStore.fetchCourseLessons(courseId)
    courseLessons.value = lessons
    const course = courseStore.getCourseById(courseId)
    if (course) {
      course.lessonCount = lessons.length
    }
  } catch (err) {
    console.error('Failed to load course lessons:', err)
  } finally {
    isLoadingLessons.value = false
  }
}

async function toggleExpandLesson(lessonId: string) {
  if (expandedLessonId.value === lessonId) {
    expandedLessonId.value = null
    return
  }
  expandedLessonId.value = lessonId
  if (!lessonDetailsCache.value[lessonId]) {
    const fullLesson = await courseStore.fetchLesson(lessonId)
    if (fullLesson) {
      lessonDetailsCache.value[lessonId] = fullLesson
    }
  }
}

function toggleImportToLesson(lesson: LessonItem) {
  if (activeImportLessonId.value === lesson.id) {
    activeImportLessonId.value = null
    return
  }
  activeImportLessonId.value = lesson.id
  sectionImportSuccessMsg.value = ''
  sectionTxtInput.value = activeTab.value === 'teaching_square' ? sampleTeachingTxt : sampleCourseTxt
  sectionDurationSeconds.value = lesson.practiceTimeSeconds || 120
  handleParseSectionTxt()
}

function handleParseSectionTxt() {
  sectionImportSuccessMsg.value = ''
  sectionParseResult.value = importerService.parseTxtContent(sectionTxtInput.value)
  if (sectionParseResult.value.success && sectionParseResult.value.sentences) {
    const sCount = sectionParseResult.value.sentences.length
    const est = Math.max(30, Math.round(sCount * 15))
    sectionRecommendedSeconds.value = est
    sectionDurationSeconds.value = est
  }
}

async function handleConfirmImportToLesson(lessonId: string, currentCourseId: string) {
  if (!sectionParseResult.value?.success) {
    handleParseSectionTxt()
  }
  if (!sectionParseResult.value?.success) {
    return
  }

  try {
    isImportingToSection.value = true
    const res = await courseStore.importDataToLesson(lessonId, {
      txtContent: sectionTxtInput.value,
      practiceTimeSeconds: Number(sectionDurationSeconds.value) || sectionRecommendedSeconds.value,
      courseId: currentCourseId,
    })
    if (res.success) {
      sectionImportSuccessMsg.value = res.message || '导入成功！数据已持久化至当前小节。'
      // Clear cache and reload so expanded inspector shows updated data
      delete lessonDetailsCache.value[lessonId]
      await loadCourseLessons(currentCourseId)
      if (expandedLessonId.value === lessonId) {
        const fullLesson = await courseStore.fetchLesson(lessonId)
        if (fullLesson) {
          lessonDetailsCache.value[lessonId] = fullLesson
        }
      }
    } else {
      alert('导入失败：' + (res.errorMessage || '未知错误'))
    }
  } catch (err: any) {
    alert('导入异常：' + err.message)
  } finally {
    isImportingToSection.value = false
  }
}

// ----------------- Section Create & Edit Actions -----------------
function openCreateLessonModal() {
  const nextNum = courseLessons.value.length > 0
    ? Math.max(...courseLessons.value.map(l => l.lessonNumber)) + 1
    : 1
  newLesson.value = {
    lessonNumber: nextNum,
    titleEn: `Lesson ${nextNum}: Core Expressions`,
    titleCn: `第 ${nextNum} 节：核心表达与专项练习`,
    practiceTimeSeconds: 120,
    txtContent: '',
  }
  showCreateLessonModal.value = true
}

async function handleCreateLessonSubmit(courseId: string) {
  if (!newLesson.value.titleCn.trim()) {
    alert('请填写小节中文标题')
    return
  }
  try {
    isCreatingLesson.value = true
    const res = await courseStore.createLesson(courseId, {
      lessonNumber: newLesson.value.lessonNumber,
      titleEn: newLesson.value.titleEn,
      titleCn: newLesson.value.titleCn,
      practiceTimeSeconds: Number(newLesson.value.practiceTimeSeconds) || 120,
      txtContent: newLesson.value.txtContent.trim() || undefined,
    })
    if (res.success) {
      showCreateLessonModal.value = false
      await loadCourseLessons(courseId)
    } else {
      alert('创建失败：' + (res.errorMessage || '未知错误'))
    }
  } catch (err: any) {
    alert('创建异常：' + err.message)
  } finally {
    isCreatingLesson.value = false
  }
}

function openEditLessonModal(l: LessonItem) {
  editLesson.value = {
    id: l.id,
    lessonNumber: l.lessonNumber,
    titleEn: l.titleEn,
    titleCn: l.titleCn,
    practiceTimeSeconds: l.practiceTimeSeconds,
  }
  showEditLessonModal.value = true
}

async function handleUpdateLessonSubmit(courseId: string) {
  try {
    isUpdatingLesson.value = true
    const res = await courseStore.updateLesson(editLesson.value.id, {
      lessonNumber: editLesson.value.lessonNumber,
      titleEn: editLesson.value.titleEn,
      titleCn: editLesson.value.titleCn,
      practiceTimeSeconds: Number(editLesson.value.practiceTimeSeconds),
      courseId,
    })
    if (res.success) {
      showEditLessonModal.value = false
      await loadCourseLessons(courseId)
    } else {
      alert('修改失败：' + (res.error || '未知错误'))
    }
  } catch (err: any) {
    alert('修改异常：' + err.message)
  } finally {
    isUpdatingLesson.value = false
  }
}

async function handleDeleteLesson(lessonId: string, courseId: string) {
  if (!confirm('确定要从数据库中彻底删除此小节及其包含的所有题目吗？')) return
  const res = await courseStore.deleteLesson(lessonId, courseId)
  if (res.success) {
    await loadCourseLessons(courseId)
    if (expandedLessonId.value === lessonId) expandedLessonId.value = null
    if (activeImportLessonId.value === lessonId) activeImportLessonId.value = null
  } else {
    alert('删除失败：' + (res.error || '未知错误'))
  }
}

// ----------------- Course / Teaching Edit Modal State -----------------
const showEditCourseModal = ref(false)
const editCourseData = ref({
  id: '',
  type: 'course' as 'course' | 'teaching',
  title: '',
  instructorName: '',
  cover: '',
  category: 'intro',
  schoolLevel: 'primary' as SchoolLevel,
  grade: 3,
  orderNum: 1,
})
const isUpdatingCourse = ref(false)

function openEditCourseModal(c: CourseItem) {
  editCourseData.value = {
    id: c.id,
    type: c.type,
    title: c.title,
    instructorName: c.instructor.name,
    cover: c.cover,
    category: c.category,
    schoolLevel: c.schoolLevel || 'primary',
    grade: c.grade || 1,
    orderNum: c.orderNum || 1,
  }
  showEditCourseModal.value = true
}

async function handleUpdateCourseSubmit() {
  if (!editCourseData.value.title.trim()) {
    alert('请填写标题')
    return
  }
  try {
    isUpdatingCourse.value = true
    const payload = {
      title: editCourseData.value.title.trim(),
      instructorName: editCourseData.value.instructorName.trim(),
      cover: editCourseData.value.cover.trim(),
      category: editCourseData.value.category,
      schoolLevel: editCourseData.value.schoolLevel,
      grade: editCourseData.value.grade,
      orderNum: Number(editCourseData.value.orderNum) || 1,
    }
    const res = await courseStore.updateCourse(editCourseData.value.id, payload)
    if (res.success) {
      showEditCourseModal.value = false
    } else {
      alert('修改失败：' + (res.error || '未知错误'))
    }
  } catch (err: any) {
    alert('修改异常：' + err.message)
  } finally {
    isUpdatingCourse.value = false
  }
}

// ----------------- Course / Teaching Actions -----------------
async function handleCreateCourse() {
  if (!newCourse.value.title.trim()) return
  const res = await courseStore.createCourse({
    type: 'course',
    title: newCourse.value.title.trim(),
    category: newCourse.value.category,
    instructorName: newCourse.value.instructorName,
    lessonCount: newCourse.value.lessonCount,
    cover: newCourse.value.cover,
    orderNum: Number(newCourse.value.orderNum) || 1,
  })
  if (res.success) {
    showCreateCourseModal.value = false
    newCourse.value.title = ''
    await selectCourse(res.id)
  }
}

async function handleCreateTeaching() {
  if (!newTeaching.value.title.trim()) return
  const res = await courseStore.createCourse({
    type: 'teaching',
    title: newTeaching.value.title.trim(),
    schoolLevel: newTeaching.value.schoolLevel,
    grade: newTeaching.value.grade,
    instructorName: newTeaching.value.instructorName,
    lessonCount: newTeaching.value.lessonCount,
    cover: newTeaching.value.cover,
    orderNum: Number(newTeaching.value.orderNum) || 1,
  })
  if (res.success) {
    showCreateTeachingModal.value = false
    newTeaching.value.title = ''
    await selectTeaching(res.id)
  }
}

async function handleDeleteCourse(id: string) {
  if (!confirm('确定要彻底从本地 SQLite 数据库删除此课程吗？所有小节数据将一并清理。')) return
  await courseStore.deleteCourse(id)
  if (courseStore.courses.length > 0) {
    await selectCourse(courseStore.courses[0].id)
  } else {
    selectedCourseId.value = ''
    courseLessons.value = []
  }
}

async function handleDeleteTeaching(id: string) {
  if (!confirm('确定要彻底从本地 SQLite 数据库删除此教辅教材吗？所有小节数据将一并清理。')) return
  await courseStore.deleteCourse(id)
  if (courseStore.teachingMaterials.length > 0) {
    await selectTeaching(courseStore.teachingMaterials[0].id)
  } else {
    selectedTeachingId.value = ''
    courseLessons.value = []
  }
}

// ----------------- TTS Dictionary -----------------
async function loadDictionary() {
  try {
    const res = await fetch('/api/tts/dictionary')
    if (res.ok) {
      dictionaryItems.value = await res.json()
      dictionaryItems.value.forEach(item => {
        ttsService.addCorrection(item.word, {
          alias: item.spokenAlias || undefined,
          ipa: item.ipa || undefined,
        })
      })
    }
  } catch (err) {
    console.error('Failed to load dictionary:', err)
  }
}

async function addDictionaryRule() {
  if (!newWord.value.trim()) return
  try {
    const res = await adminFetch('/api/tts/dictionary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: newWord.value.trim(),
        spokenAlias: newAlias.value.trim(),
        ipa: newIpa.value.trim(),
      }),
    })
    if (res.ok) {
      await loadDictionary()
      newWord.value = ''
      newAlias.value = ''
      newIpa.value = ''
    }
  } catch (err) {
    console.error('Failed to add dictionary rule:', err)
  }
}

async function removeDictionaryRule(id: string) {
  try {
    const res = await adminFetch(`/api/tts/dictionary/${id}`, { method: 'DELETE' })
    if (res.ok) {
      dictionaryItems.value = dictionaryItems.value.filter(i => i.id !== id)
    }
  } catch (err) {
    console.error('Failed to delete rule:', err)
  }
}

function testRuleTTS(word: string) {
  ttsService.speak({ text: word })
}

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) return '0秒'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}秒`
  if (s === 0) return `${m}分钟`
  return `${m}分${s}秒`
}

// Active course & teaching material computed
const activeCourse = computed(() => courseStore.courses.find(c => c.id === selectedCourseId.value))
const activeTeaching = computed(() => courseStore.teachingMaterials.find(t => t.id === selectedTeachingId.value))
</script>

<template>
  <div class="px-5 py-6 sm:px-8 space-y-6 max-w-[1440px] mx-auto select-none">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-white tracking-wide flex flex-wrap items-center gap-2">
          <span>研习岛独立后台管理平台</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            SQLite 嵌入式引擎
          </span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            独立安全鉴权
          </span>
        </h1>
        <p class="text-xs text-slate-400 mt-1">
          用户与 VIP 会员开通、课程与教辅直属小节管理、SMTP 邮件通知与操作审计平台
        </p>
      </div>

      <!-- Independent Admin Session Bar -->
      <div class="flex items-center gap-2.5">
        <div class="px-3 py-1.5 rounded-xl bg-[#151928] border border-[#252c44] flex items-center gap-2 text-xs">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span class="font-mono font-bold text-white">{{ adminInfo?.username || 'admin' }}</span>
          <span v-if="adminInfo?.isImmutable !== false" class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-semibold">
            超级管理员（不可改名）
          </span>
        </div>

        <button
          @click="showAdminPwdModal = true"
          class="px-3 py-1.5 rounded-xl bg-[#151928] hover:bg-[#1f253b] border border-[#252c44] text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <KeyRound class="w-3.5 h-3.5 text-indigo-400" />
          <span>修改密码</span>
        </button>

        <a
          href="/courses"
          target="_blank"
          class="px-3 py-1.5 rounded-xl bg-[#151928] hover:bg-[#1f253b] border border-[#252c44] text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ExternalLink class="w-3.5 h-3.5 text-slate-400" />
          <span>前往前台</span>
        </a>

        <button
          @click="handleAdminLogout"
          class="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <LogOut class="w-3.5 h-3.5" />
          <span>退出后台</span>
        </button>
      </div>
    </div>

    <!-- Main Navigation Tabs -->
    <div class="flex items-center gap-2 border-b border-[#22283e] pb-3 overflow-x-auto">
      <button
        @click="activeTab = 'course_square'"
        :class="[
          'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0',
          activeTab === 'course_square' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-[#151928] text-slate-400 hover:text-white'
        ]"
      >
        <BookOpen class="w-4 h-4" />
        <span>课程广场管理 (课程与小节)</span>
      </button>

      <button
        @click="activeTab = 'teaching_square'"
        :class="[
          'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0',
          activeTab === 'teaching_square' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-[#151928] text-slate-400 hover:text-white'
        ]"
      >
        <GraduationCap class="w-4 h-4" />
        <span>教辅广场管理 (同步教材与小节)</span>
      </button>

      <button
        @click="activeTab = 'categories'"
        :class="[
          'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0',
          activeTab === 'categories' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-[#151928] text-slate-400 hover:text-white'
        ]"
      >
        <Layers class="w-4 h-4" />
        <span>课程与教辅分类管理</span>
      </button>

      <button
        @click="activeTab = 'users'"
        :class="[
          'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0',
          activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-[#151928] text-slate-400 hover:text-white'
        ]"
      >
        <Users class="w-4 h-4" />
        <span>全局用户管理</span>
      </button>

      <button
        @click="activeTab = 'vip_requests'"
        :class="[
          'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0',
          activeTab === 'vip_requests' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-[#151928] text-slate-400 hover:text-white'
        ]"
      >
        <ShieldCheck class="w-4 h-4 text-amber-400" />
        <span>会员升级申请</span>
      </button>

      <button
        @click="activeTab = 'sync'"
        :class="[
          'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0',
          activeTab === 'sync' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-[#151928] text-slate-400 hover:text-white'
        ]"
      >
        <RefreshCw class="w-4 h-4" />
        <span>题库同步与离线更新包</span>
      </button>

      <button
        @click="activeTab = 'dictionary'"
        :class="[
          'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0',
          activeTab === 'dictionary' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-[#151928] text-slate-400 hover:text-white'
        ]"
      >
        <BookA class="w-4 h-4" />
        <span>TTS发音纠正词典库</span>
      </button>

      <button
        @click="activeTab = 'engine'"
        :class="[
          'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0',
          activeTab === 'engine' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-[#151928] text-slate-400 hover:text-white'
        ]"
      >
        <Settings class="w-4 h-4" />
        <span>TTS引擎与缓存监控</span>
      </button>

      <button
        @click="activeTab = 'smtp'"
        :class="[
          'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0',
          activeTab === 'smtp' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-[#151928] text-slate-400 hover:text-white'
        ]"
      >
        <Mail class="w-4 h-4" />
        <span>邮件服务 (SMTP)</span>
      </button>

      <button
        @click="activeTab = 'audit'"
        :class="[
          'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0',
          activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-[#151928] text-slate-400 hover:text-white'
        ]"
      >
        <ShieldCheck class="w-4 h-4" />
        <span>操作审计日志</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- Tab 1: 课程广场管理 (课程 -> 小节管理与小节数据导入) -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'course_square'" class="space-y-6">
      <!-- Top Action Bar -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-300">课程列表 (共 {{ courseStore.courses.length }} 门)</span>
          <span class="text-[11px] text-slate-500">点击选中课程进行小节管理与数据录入</span>
        </div>
        <button
          @click="showCreateCourseModal = true"
          class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer transition-all"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>创建新课程</span>
        </button>
      </div>

      <!-- Course Cards Selection Carousel / Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          v-for="c in courseStore.courses"
          :key="c.id"
          @click="selectCourse(c.id)"
          :class="[
            'p-4 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between gap-3',
            selectedCourseId === c.id
              ? 'bg-indigo-950/30 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
              : 'bg-[#141826] border-[#22283e] hover:border-[#2f3856]'
          ]"
        >
          <div class="flex items-start gap-3">
            <img :src="c.cover" :alt="c.title" class="w-12 h-16 rounded-lg object-cover shrink-0 bg-slate-800 shadow" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                  #{{ c.orderNum || 1 }}
                </span>
                <h3 class="text-xs font-bold text-white truncate">{{ c.title }}</h3>
              </div>
              <p class="text-[11px] text-slate-400">讲师: {{ c.instructor.name }}</p>
              <div class="flex items-center gap-2 mt-2">
                <span class="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 text-[10px] font-medium">
                  {{ c.lessonCount }} 小节
                </span>
                <span class="text-[10px] text-slate-500 uppercase">{{ c.category }}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between border-t border-[#1d2338] pt-2 text-[11px]">
            <span :class="selectedCourseId === c.id ? 'text-indigo-400 font-semibold' : 'text-slate-500'">
              {{ selectedCourseId === c.id ? '● 正在管理' : '点击管理' }}
            </span>
            <div class="flex items-center gap-1.5">
              <button
                @click.stop="openEditCourseModal(c)"
                class="text-slate-400 hover:text-indigo-300 p-1 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                title="编辑基本信息"
              >
                <Edit3 class="w-3.5 h-3.5" />
                <span>编辑</span>
              </button>
              <button
                @click.stop="handleDeleteCourse(c.id)"
                class="text-slate-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                title="删除课程"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Course Sections Workstation -->
      <div v-if="activeCourse" class="p-6 rounded-2xl bg-[#121624] border border-[#22283e] space-y-6">
        <!-- Selected Course Meta Header -->
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between pb-5 border-b border-[#20263b] gap-4">
          <div class="flex items-center gap-4">
            <img :src="activeCourse.cover" class="w-12 h-16 rounded-xl object-cover shadow-md" />
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">当前操作课程</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  序号: #{{ activeCourse.orderNum || 1 }}
                </span>
                <h2 class="text-sm font-bold text-white">{{ activeCourse.title }}</h2>
              </div>
              <p class="text-xs text-slate-400 mt-1">
                讲师：{{ activeCourse.instructor.name }} · 小节数：{{ courseLessons.length }} 节 · 难度：<span class="uppercase font-mono">{{ activeCourse.category }}</span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              @click="openEditCourseModal(activeCourse)"
              class="px-3.5 py-2 rounded-xl bg-[#1c2237] hover:bg-[#252c46] border border-[#2c3552] text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 class="w-3.5 h-3.5 text-indigo-400" />
              <span>编辑基本信息</span>
            </button>
            <button
              @click="openCreateLessonModal"
              class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>新建小节</span>
            </button>
            <router-link
              :to="`/course/${activeCourse.id}`"
              target="_blank"
              class="px-3 py-2 rounded-xl bg-[#1c2237] hover:bg-[#252c46] border border-[#2c3552] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>前台课程详情页</span>
              <ExternalLink class="w-3 h-3 text-indigo-400" />
            </router-link>
          </div>
        </div>

        <!-- Section Management (小节管理看板) -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-white flex items-center gap-2">
              <ListOrdered class="w-4 h-4 text-indigo-400" />
              <span>小节管理（共 {{ courseLessons.length }} 节）</span>
              <span class="text-[11px] text-slate-400 font-normal">每个小节独立查看入库题目、进行数据导入与时长估算</span>
            </h3>
          </div>

          <!-- Loading & Empty States -->
          <div v-if="isLoadingLessons" class="p-8 text-center text-xs text-slate-400">
            正在从 MySQL 查询小节数据...
          </div>

          <div v-else-if="courseLessons.length === 0" class="p-8 rounded-2xl bg-[#0e121f] border border-dashed border-[#242b42] text-center space-y-3">
            <p class="text-xs text-slate-400">当前课程下暂无任何小节。</p>
            <button
              @click="openCreateLessonModal"
              class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>点击创建第 1 节</span>
            </button>
          </div>

          <!-- Sections List -->
          <div v-else class="space-y-4">
            <div
              v-for="l in courseLessons"
              :key="l.id"
              class="p-5 rounded-2xl bg-[#0e121f] border border-[#22283e] transition-all space-y-4"
            >
              <!-- Section Header & Actions -->
              <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <span class="admin-lesson-badge w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    #{{ l.lessonNumber }}
                  </span>
                  <div>
                    <div class="text-xs font-bold text-white flex items-center gap-2">
                      <span>{{ l.titleCn }}</span>
                      <span class="text-slate-400 font-mono text-[11px]">({{ l.titleEn }})</span>
                    </div>
                    <div class="flex items-center gap-4 text-[11px] mt-1.5">
                      <span
                        :class="[
                          'px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 text-[10px]',
                          (l.sentenceCount || 0) > 0
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        ]"
                      >
                        <CheckCircle2 v-if="(l.sentenceCount || 0) > 0" class="w-3 h-3" />
                        <AlertTriangle v-else class="w-3 h-3" />
                        {{ (l.sentenceCount || 0) > 0 ? `已入库 ${l.sentenceCount} 题` : '0 题（未录入数据）' }}
                      </span>
                      <span class="flex items-center gap-1 text-slate-400">
                        <Clock class="w-3 h-3" />
                        练习时长：{{ formatDuration(l.practiceTimeSeconds) }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Section Action Buttons -->
                <div class="flex items-center gap-2 shrink-0">
                  <!-- View Existing Data Button -->
                  <button
                    @click="toggleExpandLesson(l.id)"
                    class="px-3 py-1.5 rounded-xl bg-[#181f33] hover:bg-[#202944] text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer border border-[#27304d]"
                  >
                    <Eye class="w-3.5 h-3.5 text-indigo-400" />
                    <span>{{ expandedLessonId === l.id ? '收起数据明细' : '查看数据明细' }}</span>
                    <ChevronUp v-if="expandedLessonId === l.id" class="w-3.5 h-3.5" />
                    <ChevronDown v-else class="w-3.5 h-3.5" />
                  </button>

                  <!-- Import Data Button -->
                  <button
                    @click="toggleImportToLesson(l)"
                    :class="[
                      'px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border',
                      activeImportLessonId === l.id
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-[#181f33] hover:bg-[#202944] border-[#27304d] text-indigo-300 hover:text-white'
                    ]"
                  >
                    <UploadCloud class="w-3.5 h-3.5" />
                    <span>{{ activeImportLessonId === l.id ? '收起导入面板' : '导入题目数据' }}</span>
                  </button>

                  <!-- Edit Section Button -->
                  <button
                    @click="openEditLessonModal(l)"
                    class="p-1.5 rounded-xl bg-[#181f33] hover:bg-[#202944] border border-[#27304d] text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="编辑小节信息"
                  >
                    <Edit3 class="w-3.5 h-3.5" />
                  </button>

                  <!-- Practice Direct Link -->
                  <router-link
                    :to="`/practice/${activeCourse.id}/${l.id}`"
                    target="_blank"
                    class="admin-practice-btn px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-indigo-500/30"
                    title="在前台直接模拟测试练习此小节"
                  >
                    <span>去练习</span>
                    <ExternalLink class="w-3 h-3" />
                  </router-link>

                  <!-- Delete Section Button -->
                  <button
                    @click="handleDeleteLesson(l.id, activeCourse.id)"
                    class="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                    title="彻底删除此小节及其所有题目"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Sub-panel 1: View Existing Sentences & IPA Detail -->
              <div v-if="expandedLessonId === l.id" class="p-4 rounded-xl bg-[#141826] border border-[#22283e] space-y-3">
                <div class="flex items-center justify-between border-b border-[#20263b] pb-2">
                  <span class="text-xs font-bold text-slate-200">已存在的数据明细 (共 {{ l.sentenceCount || 0 }} 题)</span>
                  <span class="text-[11px] text-slate-500">分词音标与释义直接持久化在 MySQL 中</span>
                </div>

                <div v-if="!lessonDetailsCache[l.id]" class="text-xs text-slate-400 py-3 text-center">
                  正在从数据库检索题目数据...
                </div>

                <div v-else-if="!lessonDetailsCache[l.id].sentences || lessonDetailsCache[l.id].sentences.length === 0" class="text-xs text-slate-400 py-4 text-center space-y-2">
                  <div>该小节尚未录入题目数据。</div>
                  <button
                    @click="toggleImportToLesson(l)"
                    class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    立即导入数据
                  </button>
                </div>

                <div v-else class="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  <div
                    v-for="s in lessonDetailsCache[l.id].sentences"
                    :key="s.index"
                    class="p-3 rounded-xl bg-[#0e121f] border border-[#20263b] text-xs flex flex-col md:flex-row md:items-center justify-between gap-2"
                  >
                    <div class="space-y-1">
                      <div class="text-white font-medium flex items-center gap-2">
                        <span class="text-indigo-400 font-mono font-bold">#{{ s.index }}</span>
                        <span>{{ s.sentenceEn }}</span>
                        <button
                          @click="ttsService.speak({ text: s.sentenceEn })"
                          class="text-indigo-400 hover:text-indigo-300 p-0.5 cursor-pointer"
                          title="试听发音"
                        >
                          <Volume2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div class="text-[11px] text-slate-400 pl-6">{{ s.sentenceCn }}</div>
                    </div>

                    <!-- Words & IPA chips -->
                    <div class="flex flex-wrap items-center gap-1.5 text-[10px] pl-6 md:pl-0">
                      <span
                        v-for="w in s.words"
                        :key="w.index"
                        class="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono"
                      >
                        {{ w.word }} <span class="text-slate-400">[{{ w.phonetic }}]</span>: {{ w.meaning }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Sub-panel 2: Direct TXT Importer to Current Section -->
              <div v-if="activeImportLessonId === l.id" class="p-5 rounded-xl bg-[#141826] border border-indigo-500/30 space-y-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <UploadCloud class="w-4 h-4 text-indigo-400" />
                    <h4 class="text-xs font-bold text-white">
                      向第 {{ l.lessonNumber }} 节【{{ l.titleCn }}】导入题目数据
                    </h4>
                  </div>
                  <button
                    @click="sectionTxtInput = sampleCourseTxt; handleParseSectionTxt()"
                    class="text-xs text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles class="w-3.5 h-3.5" />
                    <span>载入高频英语示例文本</span>
                  </button>
                </div>

                <!-- Duration estimation & manual input -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] text-slate-400 mb-1">
                      本小节练习时长 (秒)
                      <span class="text-indigo-400 font-normal">（可手动输入，导入时写入数据库）</span>
                    </label>
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        v-model.number="sectionDurationSeconds"
                        min="10"
                        class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#262c42] text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <span class="text-xs text-slate-400 whitespace-nowrap">
                        ≈ {{ formatDuration(sectionDurationSeconds) }}
                      </span>
                    </div>
                  </div>

                  <!-- Smart Estimation Hint -->
                  <div class="flex items-end">
                    <div
                      v-if="sectionParseResult && sectionParseResult.success && sectionParseResult.sentences"
                      class="w-full p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-300 flex items-center justify-between gap-2"
                    >
                      <div class="flex items-center gap-1.5 min-w-0">
                        <Sparkles class="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span class="truncate">
                          智能估算：共 <strong>{{ sectionParseResult.sentences.length }}</strong> 句，推荐时长 <strong>{{ formatDuration(sectionRecommendedSeconds) }}</strong>
                        </span>
                      </div>
                      <button
                        @click="sectionDurationSeconds = sectionRecommendedSeconds"
                        class="px-2 py-1 rounded bg-indigo-600/40 hover:bg-indigo-600/60 text-[10px] text-indigo-200 cursor-pointer shrink-0"
                      >
                        应用推荐值
                      </button>
                    </div>
                    <div v-else class="text-[11px] text-slate-500 py-2">
                      输入文本后将自动计算推荐练习时长。
                    </div>
                  </div>
                </div>

                <!-- TXT Textarea -->
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between text-[11px] text-slate-400">
                    <span>粘贴小节题库 TXT 文本：</span>
                    <span class="text-indigo-400 font-mono">格式: 序号|句子|单词序号:词:义:音标;...</span>
                  </div>
                  <textarea
                    v-model="sectionTxtInput"
                    @input="handleParseSectionTxt"
                    rows="6"
                    class="w-full p-3.5 rounded-xl bg-[#0e121f] border border-[#262c42] text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
                    placeholder="在此粘贴或输入题库 TXT 内容..."
                  ></textarea>
                </div>

                <!-- Action Button & Alerts -->
                <div class="flex items-center gap-3">
                  <button
                    @click="handleParseSectionTxt"
                    class="px-4 py-2 rounded-xl bg-[#1e2438] hover:bg-[#28314e] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#2f3856]"
                  >
                    <CheckCircle2 class="w-4 h-4 text-indigo-400" />
                    <span>严格格式校验</span>
                  </button>

                  <button
                    @click="handleConfirmImportToLesson(l.id, activeCourse.id)"
                    :disabled="isImportingToSection"
                    class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    <UploadCloud class="w-4 h-4" />
                    <span>{{ isImportingToSection ? '正在入库...' : '确认导入并保存到当前小节' }}</span>
                  </button>
                </div>

                <!-- Success Alert -->
                <div v-if="sectionImportSuccessMsg" class="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{{ sectionImportSuccessMsg }}</span>
                </div>

                <!-- Error Alert -->
                <div v-if="sectionParseResult && !sectionParseResult.success" class="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs space-y-1">
                  <div class="flex items-center gap-1.5 font-bold">
                    <AlertTriangle class="w-4 h-4" />
                    <span>校验未通过：第 {{ sectionParseResult.errorLine }} 行</span>
                  </div>
                  <div class="pl-5 text-slate-300 font-mono">{{ sectionParseResult.errorMessage }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Tab 2: 教辅广场管理 (同步教材 -> 小节管理与小节数据导入) -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'teaching_square'" class="space-y-6">
      <!-- Top Action Bar -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-300">同步教材列表 (共 {{ courseStore.teachingMaterials.length }} 本)</span>
          <span class="text-[11px] text-slate-500">点击选中教辅进行小节管理与数据录入</span>
        </div>
        <button
          @click="showCreateTeachingModal = true"
          class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer transition-all"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>创建新同步教辅</span>
        </button>
      </div>

      <!-- Teaching Material Cards Selection Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          v-for="t in courseStore.teachingMaterials"
          :key="t.id"
          @click="selectTeaching(t.id)"
          :class="[
            'p-4 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between gap-3',
            selectedTeachingId === t.id
              ? 'bg-indigo-950/30 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
              : 'bg-[#141826] border-[#22283e] hover:border-[#2f3856]'
          ]"
        >
          <div class="flex items-start gap-3">
            <img :src="t.cover" :alt="t.title" class="w-12 h-16 rounded-lg object-cover shrink-0 bg-slate-800 shadow" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                  #{{ t.orderNum || 1 }}
                </span>
                <h3 class="text-xs font-bold text-white truncate">{{ t.title }}</h3>
              </div>
              <p class="text-[11px] text-slate-400 mt-1">
                {{ t.schoolLevel === 'primary' ? '小学' : t.schoolLevel }} · {{ t.grade }}年级
              </p>
              <div class="flex items-center gap-2 mt-2">
                <span class="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 text-[10px] font-medium">
                  {{ t.lessonCount }} 小节
                </span>
                <span class="text-[10px] text-slate-500 truncate">{{ t.instructor.name }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between border-t border-[#1d2338] pt-2 text-[11px]">
            <span :class="selectedTeachingId === t.id ? 'text-indigo-400 font-semibold' : 'text-slate-500'">
              {{ selectedTeachingId === t.id ? '● 正在管理' : '点击管理' }}
            </span>
            <div class="flex items-center gap-1.5">
              <button
                @click.stop="openEditCourseModal(t)"
                class="text-slate-400 hover:text-indigo-300 p-1 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                title="编辑基本信息"
              >
                <Edit3 class="w-3.5 h-3.5" />
                <span>编辑</span>
              </button>
              <button
                @click.stop="handleDeleteTeaching(t.id)"
                class="text-slate-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                title="删除教材"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Teaching Material Sections Workstation -->
      <div v-if="activeTeaching" class="p-6 rounded-2xl bg-[#121624] border border-[#22283e] space-y-6">
        <!-- Selected Teaching Material Meta Header -->
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between pb-5 border-b border-[#20263b] gap-4">
          <div class="flex items-center gap-4">
            <img :src="activeTeaching.cover" class="w-12 h-16 rounded-xl object-cover shadow-md" />
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">当前操作教材</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  序号: #{{ activeTeaching.orderNum || 1 }}
                </span>
                <h2 class="text-sm font-bold text-white">{{ activeTeaching.title }}</h2>
              </div>
              <p class="text-xs text-slate-400 mt-1">
                主讲/审订：{{ activeTeaching.instructor.name }} · 小节数：{{ courseLessons.length }} 节
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              @click="openEditCourseModal(activeTeaching)"
              class="px-3.5 py-2 rounded-xl bg-[#1c2237] hover:bg-[#252c46] border border-[#2c3552] text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 class="w-3.5 h-3.5 text-indigo-400" />
              <span>编辑基本信息</span>
            </button>
            <button
              @click="openCreateLessonModal"
              class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>新建小节</span>
            </button>
            <router-link
              :to="`/course/${activeTeaching.id}`"
              target="_blank"
              class="px-3 py-2 rounded-xl bg-[#1c2237] hover:bg-[#252c46] border border-[#2c3552] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>前台详情页</span>
              <ExternalLink class="w-3 h-3 text-indigo-400" />
            </router-link>
          </div>
        </div>

        <!-- Section Management (教材小节管理看板) -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-white flex items-center gap-2">
              <ListOrdered class="w-4 h-4 text-indigo-400" />
              <span>教材小节管理（共 {{ courseLessons.length }} 节）</span>
              <span class="text-[11px] text-slate-400 font-normal">每个小节独立维护题目数据、时长估算与一键导入</span>
            </h3>
          </div>

          <div v-if="isLoadingLessons" class="p-8 text-center text-xs text-slate-400">
            正在从 MySQL 查询教材小节数据...
          </div>

          <div v-else-if="courseLessons.length === 0" class="p-8 rounded-2xl bg-[#0e121f] border border-dashed border-[#242b42] text-center space-y-3">
            <p class="text-xs text-slate-400">当前教材下暂无任何小节。</p>
            <button
              @click="openCreateLessonModal"
              class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>点击创建第 1 节</span>
            </button>
          </div>

          <!-- Sections List -->
          <div v-else class="space-y-4">
            <div
              v-for="l in courseLessons"
              :key="l.id"
              class="p-5 rounded-2xl bg-[#0e121f] border border-[#22283e] transition-all space-y-4"
            >
              <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <span class="admin-lesson-badge w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    #{{ l.lessonNumber }}
                  </span>
                  <div>
                    <div class="text-xs font-bold text-white flex items-center gap-2">
                      <span>{{ l.titleCn }}</span>
                      <span class="text-slate-400 font-mono text-[11px]">({{ l.titleEn }})</span>
                    </div>
                    <div class="flex items-center gap-4 text-[11px] mt-1.5">
                      <span
                        :class="[
                          'px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 text-[10px]',
                          (l.sentenceCount || 0) > 0
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        ]"
                      >
                        <CheckCircle2 v-if="(l.sentenceCount || 0) > 0" class="w-3 h-3" />
                        <AlertTriangle v-else class="w-3 h-3" />
                        {{ (l.sentenceCount || 0) > 0 ? `已入库 ${l.sentenceCount} 题` : '0 题（未录入数据）' }}
                      </span>
                      <span class="flex items-center gap-1 text-slate-400">
                        <Clock class="w-3 h-3" />
                        练习时长：{{ formatDuration(l.practiceTimeSeconds) }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <button
                    @click="toggleExpandLesson(l.id)"
                    class="px-3 py-1.5 rounded-xl bg-[#181f33] hover:bg-[#202944] text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer border border-[#27304d]"
                  >
                    <Eye class="w-3.5 h-3.5 text-indigo-400" />
                    <span>{{ expandedLessonId === l.id ? '收起数据明细' : '查看数据明细' }}</span>
                    <ChevronUp v-if="expandedLessonId === l.id" class="w-3.5 h-3.5" />
                    <ChevronDown v-else class="w-3.5 h-3.5" />
                  </button>

                  <button
                    @click="toggleImportToLesson(l)"
                    :class="[
                      'px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border',
                      activeImportLessonId === l.id
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-[#181f33] hover:bg-[#202944] border-[#27304d] text-indigo-300 hover:text-white'
                    ]"
                  >
                    <UploadCloud class="w-3.5 h-3.5" />
                    <span>{{ activeImportLessonId === l.id ? '收起导入面板' : '导入题目数据' }}</span>
                  </button>

                  <button
                    @click="openEditLessonModal(l)"
                    class="p-1.5 rounded-xl bg-[#181f33] hover:bg-[#202944] border border-[#27304d] text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="编辑小节信息"
                  >
                    <Edit3 class="w-3.5 h-3.5" />
                  </button>

                  <router-link
                    :to="`/practice/${activeTeaching.id}/${l.id}`"
                    target="_blank"
                    class="admin-practice-btn px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-indigo-500/30"
                  >
                    <span>去练习</span>
                    <ExternalLink class="w-3 h-3" />
                  </router-link>

                  <button
                    @click="handleDeleteLesson(l.id, activeTeaching.id)"
                    class="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                    title="删除小节"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Sub-panel 1: View Existing Sentences Detail -->
              <div v-if="expandedLessonId === l.id" class="p-4 rounded-xl bg-[#141826] border border-[#22283e] space-y-3">
                <div class="flex items-center justify-between border-b border-[#20263b] pb-2">
                  <span class="text-xs font-bold text-slate-200">教材小节题目明细 (共 {{ l.sentenceCount || 0 }} 题)</span>
                </div>

                <div v-if="!lessonDetailsCache[l.id]" class="text-xs text-slate-400 py-3 text-center">
                  正在加载数据...
                </div>

                <div v-else-if="!lessonDetailsCache[l.id].sentences || lessonDetailsCache[l.id].sentences.length === 0" class="text-xs text-slate-400 py-4 text-center space-y-2">
                  <div>该教材小节尚未录入题目数据。</div>
                  <button
                    @click="toggleImportToLesson(l)"
                    class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    立即导入数据
                  </button>
                </div>

                <div v-else class="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  <div
                    v-for="s in lessonDetailsCache[l.id].sentences"
                    :key="s.index"
                    class="p-3 rounded-xl bg-[#0e121f] border border-[#20263b] text-xs flex flex-col md:flex-row md:items-center justify-between gap-2"
                  >
                    <div class="space-y-1">
                      <div class="text-white font-medium flex items-center gap-2">
                        <span class="text-indigo-400 font-mono font-bold">#{{ s.index }}</span>
                        <span>{{ s.sentenceEn }}</span>
                        <button
                          @click="ttsService.speak({ text: s.sentenceEn })"
                          class="text-indigo-400 hover:text-indigo-300 p-0.5 cursor-pointer"
                          title="试听发音"
                        >
                          <Volume2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div class="text-[11px] text-slate-400 pl-6">{{ s.sentenceCn }}</div>
                    </div>

                    <div class="flex flex-wrap items-center gap-1.5 text-[10px] pl-6 md:pl-0">
                      <span
                        v-for="w in s.words"
                        :key="w.index"
                        class="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono"
                      >
                        {{ w.word }} <span class="text-slate-400">[{{ w.phonetic }}]</span>: {{ w.meaning }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Sub-panel 2: Direct TXT Importer to Current Section -->
              <div v-if="activeImportLessonId === l.id" class="p-5 rounded-xl bg-[#141826] border border-indigo-500/30 space-y-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <UploadCloud class="w-4 h-4 text-indigo-400" />
                    <h4 class="text-xs font-bold text-white">
                      向第 {{ l.lessonNumber }} 节【{{ l.titleCn }}】导入题目数据
                    </h4>
                  </div>
                  <button
                    @click="sectionTxtInput = sampleTeachingTxt; handleParseSectionTxt()"
                    class="text-xs text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles class="w-3.5 h-3.5" />
                    <span>载入同步教材 PEP 示例文本</span>
                  </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] text-slate-400 mb-1">
                      本小节练习时长 (秒)
                      <span class="text-indigo-400 font-normal">（可手动输入，导入时持久化）</span>
                    </label>
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        v-model.number="sectionDurationSeconds"
                        min="10"
                        class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#262c42] text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <span class="text-xs text-slate-400 whitespace-nowrap">
                        ≈ {{ formatDuration(sectionDurationSeconds) }}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-end">
                    <div
                      v-if="sectionParseResult && sectionParseResult.success && sectionParseResult.sentences"
                      class="w-full p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-300 flex items-center justify-between gap-2"
                    >
                      <div class="flex items-center gap-1.5 min-w-0">
                        <Sparkles class="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span class="truncate">
                          智能估算：共 <strong>{{ sectionParseResult.sentences.length }}</strong> 句，推荐时长 <strong>{{ formatDuration(sectionRecommendedSeconds) }}</strong>
                        </span>
                      </div>
                      <button
                        @click="sectionDurationSeconds = sectionRecommendedSeconds"
                        class="px-2 py-1 rounded bg-indigo-600/40 hover:bg-indigo-600/60 text-[10px] text-indigo-200 cursor-pointer shrink-0"
                      >
                        应用推荐值
                      </button>
                    </div>
                  </div>
                </div>

                <div class="space-y-1.5">
                  <div class="flex items-center justify-between text-[11px] text-slate-400">
                    <span>粘贴小节题库 TXT 文本：</span>
                    <span class="text-indigo-400 font-mono">格式: 序号|句子|单词序号:词:义:音标;...</span>
                  </div>
                  <textarea
                    v-model="sectionTxtInput"
                    @input="handleParseSectionTxt"
                    rows="6"
                    class="w-full p-3.5 rounded-xl bg-[#0e121f] border border-[#262c42] text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
                    placeholder="在此粘贴或输入题库 TXT 内容..."
                  ></textarea>
                </div>

                <div class="flex items-center gap-3">
                  <button
                    @click="handleParseSectionTxt"
                    class="px-4 py-2 rounded-xl bg-[#1e2438] hover:bg-[#28314e] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#2f3856]"
                  >
                    <CheckCircle2 class="w-4 h-4 text-indigo-400" />
                    <span>严格格式校验</span>
                  </button>

                  <button
                    @click="handleConfirmImportToLesson(l.id, activeTeaching.id)"
                    :disabled="isImportingToSection"
                    class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    <UploadCloud class="w-4 h-4" />
                    <span>{{ isImportingToSection ? '正在入库...' : '确认导入并保存到当前小节' }}</span>
                  </button>
                </div>

                <div v-if="sectionImportSuccessMsg" class="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{{ sectionImportSuccessMsg }}</span>
                </div>

                <div v-if="sectionParseResult && !sectionParseResult.success" class="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs space-y-1">
                  <div class="flex items-center gap-1.5 font-bold">
                    <AlertTriangle class="w-4 h-4" />
                    <span>校验未通过：第 {{ sectionParseResult.errorLine }} 行</span>
                  </div>
                  <div class="pl-5 text-slate-300 font-mono">{{ sectionParseResult.errorMessage }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Tab 3: TTS 发音纠正词典库 (MySQL Persistence) -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'dictionary'" class="space-y-5">
      <div class="p-4 rounded-2xl bg-[#141826] border border-[#22283e] space-y-2 text-xs">
        <div class="font-bold text-slate-200">TTS 多音字/专有名词纠正机制（持久化至 MySQL 表 `tts_dictionary`）：</div>
        <div class="text-slate-400">
          当纯文本合成遇到如 iPhone (读音别名)、UNESCO (国际IPA音标)、YanXiDao 等生僻专有名词时，系统通过字典规则拦截并自动包裹 SSML &lt;phoneme&gt; 或 &lt;sub&gt; 别名。
        </div>
      </div>

      <!-- Add Rule Card -->
      <div class="p-5 rounded-2xl bg-[#141826] border border-[#22283e] space-y-4">
        <h3 class="text-xs font-bold text-white flex items-center gap-2">
          <Plus class="w-4 h-4 text-indigo-400" />
          <span>添加新纠错词条</span>
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">目标原词 (Word)</label>
            <input
              v-model="newWord"
              placeholder="如: iPhone"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#22283e] text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">口语别名 (Spoken Alias，可选)</label>
            <input
              v-model="newAlias"
              placeholder="如: I phone"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#22283e] text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">标准国际音标 (IPA，可选)</label>
            <input
              v-model="newIpa"
              placeholder="如: juːˈnɛskoʊ"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#22283e] text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
          <div class="flex items-end">
            <button
              @click="addDictionaryRule"
              class="w-full px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>保存到 MySQL 词典</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Rule List Table -->
      <div class="rounded-2xl border border-[#22283e] overflow-hidden bg-[#141826]">
        <table class="w-full text-xs text-left">
          <thead class="admin-table-head bg-[#101422] text-slate-400 uppercase text-[10px] border-b border-[#22283e]">
            <tr>
              <th class="px-5 py-3">目标原词</th>
              <th class="px-5 py-3">发音别名 (Alias)</th>
              <th class="px-5 py-3">国际音标 (IPA)</th>
              <th class="px-5 py-3 text-right">操作与发音试听</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#1e2438]">
            <tr v-for="item in dictionaryItems" :key="item.id" class="hover:bg-[#191e30] transition-colors">
              <td class="px-5 py-3 font-semibold text-white">{{ item.word }}</td>
              <td class="px-5 py-3 text-slate-300 font-mono">{{ item.spokenAlias || '-' }}</td>
              <td class="px-5 py-3 text-indigo-400 font-mono">{{ item.ipa || '-' }}</td>
              <td class="px-5 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    @click="testRuleTTS(item.word)"
                    class="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-colors cursor-pointer"
                    title="试听发音"
                  >
                    <Volume2 class="w-3.5 h-3.5" />
                  </button>
                  <button
                    @click="removeDictionaryRule(item.id)"
                    class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                    title="从数据库删除"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Tab 4: 分类体系管理 (课程难度与教辅学段年级) -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'categories'" class="space-y-5">
      <CategoryManagement @changed="fetchAdminCategories" />
    </div>

    <!-- ========================================================================= -->
    <!-- Tab: 全局用户管理 (用户信息、进度、收藏与复习本学情中心) -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'users'" class="space-y-5">
      <UserManagement />
    </div>

    <!-- ========================================================================= -->
    <!-- Tab: 会员升级申请与审批沟通 -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'vip_requests'" class="space-y-5">
      <AdminVipRequestsPanel />
    </div>

    <!-- ========================================================================= -->
    <!-- Tab: 题库同步与离线更新包 (.yxdpack 导出 / 导入 / 云端 URL 同步) -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'sync'" class="space-y-5">
      <CourseSyncManager @synced="fetchAdminCategories" />
    </div>

    <!-- ========================================================================= -->
    <!-- Tab: 邮件服务 (SMTP) 与发信日志 -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'smtp'" class="space-y-5">
      <AdminSmtpPanel />
    </div>

    <!-- ========================================================================= -->
    <!-- Tab: 操作审计日志 -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'audit'" class="space-y-5">
      <AdminAuditPanel />
    </div>

    <!-- ========================================================================= -->
    <!-- Tab 5: TTS 引擎与缓存监控 -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'engine'" class="space-y-5">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-5 rounded-2xl bg-[#141826] border border-[#22283e] space-y-2">
          <div class="text-xs text-slate-400">语音合成引擎状态</div>
          <div class="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Web Speech API 就绪</span>
          </div>
          <p class="text-[11px] text-slate-500">零静态音频上传，纯前端+音标发音实时合成</p>
        </div>

        <div class="p-5 rounded-2xl bg-[#141826] border border-[#22283e] space-y-2">
          <div class="text-xs text-slate-400">嵌入式数据库连接状态</div>
          <div class="text-lg font-bold text-indigo-400">
            <span>SQLite (data/yanxidao.db)</span>
          </div>
          <p class="text-[11px] text-slate-500">本地嵌入式 WAL 引擎，随开随用、关机零残留</p>
        </div>

        <div class="p-5 rounded-2xl bg-[#141826] border border-[#22283e] space-y-2">
          <div class="text-xs text-slate-400">TTS 本地音素缓存</div>
          <div class="text-lg font-bold text-white">IndexedDB (idb-keyval)</div>
          <p class="text-[11px] text-slate-500">支持高频词句发音秒级快速播放</p>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: Create Course -->
    <!-- ========================================================================= -->
    <div
      v-if="showCreateCourseModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="bg-[#141826] border border-[#28304a] w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#22283e] pb-3">
          <h3 class="text-sm font-bold text-white">创建新课程 (课程广场)</h3>
          <button @click="showCreateCourseModal = false" class="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">课程标题</label>
            <input
              v-model="newCourse.title"
              placeholder="例如: 商务英语高频谈判400句"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-400 mb-1">难度等级</label>
              <CustomSelect
                v-model="newCourse.category"
                :options="courseCategorySelectOptions"
              />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">规划总小节数</label>
              <input
                type="number"
                v-model.number="newCourse.lessonCount"
                min="1"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-400 mb-1">讲师名称</label>
              <input
                v-model="newCourse.instructorName"
                placeholder="例如: Lucas"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">
                排序次序 <span class="text-amber-400 font-mono text-[10px]">(1最前)</span>
              </label>
              <input
                type="number"
                v-model.number="newCourse.orderNum"
                min="1"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-amber-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">封面图片 URL</label>
            <input
              v-model="newCourse.cover"
              placeholder="https://images.unsplash.com/..."
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500 text-[11px]"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#22283e]">
          <button
            @click="showCreateCourseModal = false"
            class="px-4 py-2 rounded-xl bg-[#1e2338] text-slate-300 text-xs font-medium cursor-pointer"
          >
            取消
          </button>
          <button
            @click="handleCreateCourse"
            class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
          >
            创建入库
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: Create Teaching Material -->
    <!-- ========================================================================= -->
    <div
      v-if="showCreateTeachingModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="bg-[#141826] border border-[#28304a] w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#22283e] pb-3">
          <h3 class="text-sm font-bold text-white">创建新同步教辅 (教辅广场)</h3>
          <button @click="showCreateTeachingModal = false" class="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">教辅教材标题</label>
            <input
              v-model="newTeaching.title"
              placeholder="例如: 五年级下册人教版PEP"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-slate-400 mb-1">学段</label>
              <CustomSelect
                v-model="newTeaching.schoolLevel"
                :options="teachingLevelSelectOptions"
                placeholder="请选择学段"
              />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">年级</label>
              <CustomSelect
                v-model="newTeaching.grade"
                :options="newTeachingGradeSelectOptions"
                placeholder="请选择年级"
              />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">规划总小节数</label>
              <input
                type="number"
                v-model.number="newTeaching.lessonCount"
                min="1"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-400 mb-1">主讲 / 审订老师</label>
              <input
                v-model="newTeaching.instructorName"
                placeholder="例如: Stella"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">
                排序次序 <span class="text-amber-400 font-mono text-[10px]">(1最前)</span>
              </label>
              <input
                type="number"
                v-model.number="newTeaching.orderNum"
                min="1"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-amber-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">封面图片 URL</label>
            <input
              v-model="newTeaching.cover"
              placeholder="https://images.unsplash.com/..."
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500 text-[11px]"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#22283e]">
          <button
            @click="showCreateTeachingModal = false"
            class="px-4 py-2 rounded-xl bg-[#1e2338] text-slate-300 text-xs font-medium cursor-pointer"
          >
            取消
          </button>
          <button
            @click="handleCreateTeaching"
            class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
          >
            创建入库
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: Edit Course / Teaching Material Basic Info -->
    <!-- ========================================================================= -->
    <div
      v-if="showEditCourseModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="bg-[#141826] border border-[#28304a] w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#22283e] pb-3">
          <div class="flex items-center gap-2">
            <Edit3 class="w-4 h-4 text-indigo-400" />
            <h3 class="text-sm font-bold text-white">
              编辑{{ editCourseData.type === 'teaching' ? '教辅教材' : '课程' }}基本信息
            </h3>
          </div>
          <button @click="showEditCourseModal = false" class="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
        </div>

        <div class="space-y-4 text-xs">
          <!-- Title -->
          <div>
            <label class="block text-slate-400 mb-1 font-medium">
              {{ editCourseData.type === 'teaching' ? '教辅教材标题' : '课程标题' }}
            </label>
            <input
              v-model="editCourseData.title"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <!-- Order Num and Instructor -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1 font-medium">
                列表排序次序
                <span class="text-amber-400 text-[11px] font-mono">（1 最前依次排后）</span>
              </label>
              <input
                type="number"
                v-model.number="editCourseData.orderNum"
                min="1"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-amber-300 focus:outline-none focus:border-indigo-500 font-mono font-bold text-sm"
              />
              <span class="text-[10px] text-slate-500 mt-0.5 block">数值越小排在列表越前位置</span>
            </div>
            <div>
              <label class="block text-slate-400 mb-1 font-medium">
                {{ editCourseData.type === 'teaching' ? '主讲/审订老师' : '讲师名称' }}
              </label>
              <input
                v-model="editCourseData.instructorName"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <!-- Category or SchoolLevel/Grade -->
          <div v-if="editCourseData.type === 'course'" class="space-y-1">
            <label class="block text-slate-400 mb-1 font-medium">难度等级</label>
            <CustomSelect
              v-model="editCourseData.category"
              :options="courseCategorySelectOptions"
              placeholder="请选择等级分类"
            />
          </div>
          <div v-else class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1 font-medium">学段</label>
              <CustomSelect
                v-model="editCourseData.schoolLevel"
                :options="teachingLevelSelectOptions"
                placeholder="请选择学段"
              />
            </div>
            <div>
              <label class="block text-slate-400 mb-1 font-medium">年级</label>
              <CustomSelect
                v-model="editCourseData.grade"
                :options="editTeachingGradeSelectOptions"
                placeholder="请选择年级"
              />
            </div>
          </div>

          <!-- Cover with preview -->
          <div>
            <label class="block text-slate-400 mb-1 font-medium">封面图片 URL</label>
            <div class="flex gap-3 items-start">
              <input
                v-model="editCourseData.cover"
                placeholder="https://..."
                class="flex-1 px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500 text-[11px]"
              />
              <div class="w-14 h-18 rounded-lg overflow-hidden border border-[#2d3652] bg-slate-900 shrink-0">
                <img
                  v-if="editCourseData.cover"
                  :src="editCourseData.cover"
                  class="w-full h-full object-cover"
                  alt="预览"
                />
                <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-slate-500">无封面</div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-[#22283e]">
          <button
            @click="showEditCourseModal = false"
            class="px-4 py-2 rounded-xl bg-[#1e2338] text-slate-300 text-xs font-medium cursor-pointer hover:text-white"
          >
            取消
          </button>
          <button
            @click="handleUpdateCourseSubmit"
            :disabled="isUpdatingCourse"
            class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <CheckCircle2 class="w-3.5 h-3.5" />
            <span>{{ isUpdatingCourse ? '正在保存...' : '保存修改' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: Create Section / Lesson (新建小节) -->
    <!-- ========================================================================= -->
    <div
      v-if="showCreateLessonModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="bg-[#141826] border border-[#28304a] w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#22283e] pb-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <Plus class="w-4 h-4 text-indigo-400" />
            <span>
              新建小节 (归入【{{ activeTab === 'course_square' ? activeCourse?.title : activeTeaching?.title }}】)
            </span>
          </h3>
          <button @click="showCreateLessonModal = false" class="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-slate-400 mb-1">小节节次序号</label>
              <input
                type="number"
                v-model.number="newLesson.lessonNumber"
                min="1"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div class="col-span-2">
              <label class="block text-slate-400 mb-1">预估练习时长 (秒)</label>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  v-model.number="newLesson.practiceTimeSeconds"
                  min="10"
                  class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <span class="text-slate-400 whitespace-nowrap text-[11px]">
                  ≈ {{ formatDuration(newLesson.practiceTimeSeconds) }}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">小节中文标题</label>
            <input
              v-model="newLesson.titleCn"
              placeholder="例如: 第 1 节：打招呼与日常问候"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 mb-1">小节英文标题</label>
            <input
              v-model="newLesson.titleEn"
              placeholder="例如: Lesson 1: Hello and Greetings"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label class="block text-slate-400 mb-1">可选：直接粘贴 TXT 题库内容（留空则创建空小节稍后录入）</label>
            <textarea
              v-model="newLesson.txtContent"
              rows="4"
              class="w-full p-3 rounded-xl bg-[#0e121f] border border-[#252b41] text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500 resize-y"
              placeholder="1|What's up?|1:What's:什么:wʌts;2:up:最近咋样:ʌp;..."
            ></textarea>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#22283e]">
          <button
            @click="showCreateLessonModal = false"
            class="px-4 py-2 rounded-xl bg-[#1e2338] text-slate-300 text-xs font-medium cursor-pointer"
          >
            取消
          </button>
          <button
            @click="handleCreateLessonSubmit(activeTab === 'course_square' ? activeCourse!.id : activeTeaching!.id)"
            :disabled="isCreatingLesson"
            class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
          >
            {{ isCreatingLesson ? '正在保存...' : '确认创建小节' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: Edit Section / Lesson (编辑小节信息) -->
    <!-- ========================================================================= -->
    <div
      v-if="showEditLessonModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="bg-[#141826] border border-[#28304a] w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#22283e] pb-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <Edit3 class="w-4 h-4 text-indigo-400" />
            <span>编辑小节基本信息</span>
          </h3>
          <button @click="showEditLessonModal = false" class="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-slate-400 mb-1">小节节次</label>
              <input
                type="number"
                v-model.number="editLesson.lessonNumber"
                min="1"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div class="col-span-2">
              <label class="block text-slate-400 mb-1">练习时长 (秒)</label>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  v-model.number="editLesson.practiceTimeSeconds"
                  min="10"
                  class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <span class="text-slate-400 whitespace-nowrap text-[11px]">
                  ≈ {{ formatDuration(editLesson.practiceTimeSeconds) }}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">小节中文标题</label>
            <input
              v-model="editLesson.titleCn"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 mb-1">小节英文标题</label>
            <input
              v-model="editLesson.titleEn"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#22283e]">
          <button
            @click="showEditLessonModal = false"
            class="px-4 py-2 rounded-xl bg-[#1e2338] text-slate-300 text-xs font-medium cursor-pointer"
          >
            取消
          </button>
          <button
            @click="handleUpdateLessonSubmit(activeTab === 'course_square' ? activeCourse!.id : activeTeaching!.id)"
            :disabled="isUpdatingLesson"
            class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
          >
            {{ isUpdatingLesson ? '正在保存...' : '保存更改' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Admin Change Password Modal -->
    <div
      v-if="showAdminPwdModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      @click.self="showAdminPwdModal = false"
    >
      <div class="w-full max-w-sm bg-[#161a29] border border-[#2a314b] rounded-2xl p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <KeyRound class="w-4 h-4 text-indigo-400" />
            <span>修改超级管理员密码</span>
          </h3>
          <span class="text-[11px] font-mono text-slate-400">{{ adminInfo?.username || 'admin' }}</span>
        </div>
        <p class="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          注意：默认超级管理员账号名（admin）受系统保护，不可修改。
        </p>
        <div class="space-y-3">
          <input
            v-model="adminOldPwd"
            type="password"
            placeholder="请输入当前密码"
            class="w-full px-3 py-2 rounded-xl bg-[#0e111b] border border-[#252c44] text-xs text-white outline-none focus:border-indigo-500"
          />
          <input
            v-model="adminNewPwd"
            type="password"
            placeholder="请输入新密码（至少8位）"
            class="w-full px-3 py-2 rounded-xl bg-[#0e111b] border border-[#252c44] text-xs text-white outline-none focus:border-indigo-500"
          />
          <input
            v-model="adminConfirmPwd"
            type="password"
            placeholder="请再次确认新密码"
            class="w-full px-3 py-2 rounded-xl bg-[#0e111b] border border-[#252c44] text-xs text-white outline-none focus:border-indigo-500"
          />
        </div>
        <p v-if="adminPwdErr" class="text-xs text-rose-400">{{ adminPwdErr }}</p>
        <p v-if="adminPwdMsg" class="text-xs text-emerald-400">{{ adminPwdMsg }}</p>
        <div class="flex items-center justify-end gap-2 pt-1">
          <button
            @click="showAdminPwdModal = false"
            class="px-4 py-2 rounded-xl bg-[#20273f] text-xs font-semibold text-slate-300 cursor-pointer"
          >
            取消
          </button>
          <button
            @click="submitAdminChangePassword"
            :disabled="adminPwdLoading"
            class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
          >
            {{ adminPwdLoading ? '保存中...' : '确认修改' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
