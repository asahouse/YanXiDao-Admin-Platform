<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { CourseCategoryItem, SchoolLevelItem, GradeItem } from '../../types'
import {
  GraduationCap,
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  ChevronRight,
} from 'lucide-vue-next'
import CustomSelect from '../common/CustomSelect.vue'
import { adminFetch } from '../../utils/adminApi'

const emit = defineEmits<{
  (e: 'changed'): void
}>()

const statusOptions = [
  { label: '启用 (前台可见)', value: true },
  { label: '停用 (前台隐藏)', value: false },
]

const gradeStatusOptions = [
  { label: '启用 (在教辅广场二级过滤器中显示)', value: true },
  { label: '停用 (前台隐藏)', value: false },
]

// Active Sub-Tab: 'course' | 'teaching'
const activeSubTab = ref<'course' | 'teaching'>('course')

// Data states
const courseCategories = ref<CourseCategoryItem[]>([])
const schoolLevels = ref<SchoolLevelItem[]>([])
const selectedLevelKey = ref<string>('primary')
const isLoading = ref(false)
const toastMsg = ref('')

function showToast(msg: string) {
  toastMsg.value = msg
  setTimeout(() => { toastMsg.value = '' }, 2500)
}

// ----------------- Fetch Categories -----------------
async function loadData() {
  isLoading.value = true
  try {
    const [cRes, tRes] = await Promise.all([
      adminFetch('/api/categories/courses'),
      adminFetch('/api/categories/teaching')
    ])
    if (cRes.ok) courseCategories.value = await cRes.json()
    if (tRes.ok) {
      schoolLevels.value = await tRes.json()
      if (!selectedLevelKey.value && schoolLevels.value.length > 0) {
        selectedLevelKey.value = schoolLevels.value[0].levelKey
      }
    }
  } catch (err) {
    console.error('Failed to load categories:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadData()
})

// Current selected school level
const currentSchoolLevel = computed(() => {
  return schoolLevels.value.find(l => l.levelKey === selectedLevelKey.value) || schoolLevels.value[0] || null
})

// ----------------- Course Category Modals & Operations -----------------
const showCourseCatModal = ref(false)
const isEditingCourseCat = ref(false)
const courseCatForm = ref({
  id: '',
  name: '',
  catKey: '',
  orderNum: 1,
  isEnabled: true,
})

function openCreateCourseCatModal() {
  isEditingCourseCat.value = false
  courseCatForm.value = {
    id: '',
    name: '',
    catKey: '',
    orderNum: courseCategories.value.length + 1,
    isEnabled: true,
  }
  showCourseCatModal.value = true
}

function openEditCourseCatModal(item: CourseCategoryItem) {
  isEditingCourseCat.value = true
  courseCatForm.value = {
    id: item.id,
    name: item.name,
    catKey: item.catKey,
    orderNum: item.orderNum,
    isEnabled: item.isEnabled,
  }
  showCourseCatModal.value = true
}

async function handleSaveCourseCat() {
  const form = courseCatForm.value
  if (!form.name.trim() || !form.catKey.trim()) {
    alert('分类名称与编码Key必填')
    return
  }

  try {
    if (isEditingCourseCat.value) {
      const res = await adminFetch(`/api/categories/courses/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        showToast('课程分类已修改保存')
        showCourseCatModal.value = false
        await loadData()
        emit('changed')
      } else {
        const data = await res.json()
        alert(data.error || '保存失败')
      }
    } else {
      const res = await adminFetch('/api/categories/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        showToast('新建课程分类成功')
        showCourseCatModal.value = false
        await loadData()
        emit('changed')
      } else {
        const data = await res.json()
        alert(data.error || '创建失败')
      }
    }
  } catch (err) {
    console.error('Failed to save course category:', err)
  }
}

async function handleToggleCourseCatEnabled(item: CourseCategoryItem) {
  try {
    const updatedStatus = !item.isEnabled
    const res = await adminFetch(`/api/categories/courses/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: updatedStatus })
    })
    if (res.ok) {
      item.isEnabled = updatedStatus
      showToast(`「${item.name}」已${updatedStatus ? '启用' : '停用'}`)
      emit('changed')
    }
  } catch (err) {
    console.error('Failed to toggle status:', err)
  }
}

async function handleDeleteCourseCat(item: CourseCategoryItem) {
  if (item.courseCount && item.courseCount > 0) {
    alert(`该分类下仍有关联的 ${item.courseCount} 门课程，无法直接删除！请先将课程调整分类，或直接将此分类设为停用。`)
    return
  }
  if (!confirm(`确定要删除课程分类「${item.name}」吗？`)) return

  try {
    const res = await adminFetch(`/api/categories/courses/${item.id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('分类已删除')
      await loadData()
      emit('changed')
    } else {
      const data = await res.json()
      alert(data.error || '删除失败')
    }
  } catch (err) {
    console.error('Failed to delete category:', err)
  }
}

// ----------------- School Level Modals & Operations -----------------
const showSchoolLevelModal = ref(false)
const isEditingSchoolLevel = ref(false)
const schoolLevelForm = ref({
  id: '',
  name: '',
  levelKey: '',
  orderNum: 1,
  isEnabled: true,
})

function openCreateSchoolLevelModal() {
  isEditingSchoolLevel.value = false
  schoolLevelForm.value = {
    id: '',
    name: '',
    levelKey: '',
    orderNum: schoolLevels.value.length + 1,
    isEnabled: true,
  }
  showSchoolLevelModal.value = true
}

function openEditSchoolLevelModal(item: SchoolLevelItem) {
  isEditingSchoolLevel.value = true
  schoolLevelForm.value = {
    id: item.id,
    name: item.name,
    levelKey: item.levelKey,
    orderNum: item.orderNum,
    isEnabled: item.isEnabled,
  }
  showSchoolLevelModal.value = true
}

async function handleSaveSchoolLevel() {
  const form = schoolLevelForm.value
  if (!form.name.trim() || !form.levelKey.trim()) {
    alert('学段名称与编码Key必填')
    return
  }

  try {
    if (isEditingSchoolLevel.value) {
      const res = await adminFetch(`/api/categories/school-levels/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        showToast('学段已修改保存')
        showSchoolLevelModal.value = false
        await loadData()
        emit('changed')
      } else {
        const data = await res.json()
        alert(data.error || '保存失败')
      }
    } else {
      const res = await adminFetch('/api/categories/school-levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        showToast('新建学段成功')
        showSchoolLevelModal.value = false
        await loadData()
        selectedLevelKey.value = form.levelKey
        emit('changed')
      } else {
        const data = await res.json()
        alert(data.error || '创建失败')
      }
    }
  } catch (err) {
    console.error('Failed to save school level:', err)
  }
}

async function handleToggleLevelEnabled(item: SchoolLevelItem) {
  try {
    const updatedStatus = !item.isEnabled
    const res = await adminFetch(`/api/categories/school-levels/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: updatedStatus })
    })
    if (res.ok) {
      item.isEnabled = updatedStatus
      showToast(`「${item.name}」学段已${updatedStatus ? '启用' : '停用'}`)
      emit('changed')
    }
  } catch (err) {
    console.error('Failed to toggle level status:', err)
  }
}

async function handleDeleteSchoolLevel(item: SchoolLevelItem) {
  if (item.teachingCount && item.teachingCount > 0) {
    alert(`该学段下仍有关联的 ${item.teachingCount} 本教辅，无法直接删除！请先将教辅调整学段，或直接将此学段设为停用。`)
    return
  }
  if (!confirm(`确定要删除学段「${item.name}」及其下属年级吗？`)) return

  try {
    const res = await adminFetch(`/api/categories/school-levels/${item.id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('学段已删除')
      await loadData()
      emit('changed')
    } else {
      const data = await res.json()
      alert(data.error || '删除失败')
    }
  } catch (err) {
    console.error('Failed to delete school level:', err)
  }
}

// ----------------- Grade Modals & Operations -----------------
const showGradeModal = ref(false)
const isEditingGrade = ref(false)
const gradeForm = ref({
  id: '',
  levelKey: '',
  gradeValue: 1,
  name: '',
  orderNum: 1,
  isEnabled: true,
})

function openCreateGradeModal() {
  if (!currentSchoolLevel.value) return
  isEditingGrade.value = false
  const currentCount = currentSchoolLevel.value.grades?.length || 0
  gradeForm.value = {
    id: '',
    levelKey: currentSchoolLevel.value.levelKey,
    gradeValue: currentCount + 1,
    name: '',
    orderNum: currentCount + 1,
    isEnabled: true,
  }
  showGradeModal.value = true
}

function openEditGradeModal(grade: GradeItem) {
  isEditingGrade.value = true
  gradeForm.value = {
    id: grade.id,
    levelKey: grade.levelKey,
    gradeValue: grade.gradeValue,
    name: grade.name,
    orderNum: grade.orderNum,
    isEnabled: grade.isEnabled,
  }
  showGradeModal.value = true
}

async function handleSaveGrade() {
  const form = gradeForm.value
  if (!form.name.trim()) {
    alert('年级名称必填')
    return
  }

  try {
    if (isEditingGrade.value) {
      const res = await adminFetch(`/api/categories/grades/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        showToast('年级已修改保存')
        showGradeModal.value = false
        await loadData()
        emit('changed')
      } else {
        const data = await res.json()
        alert(data.error || '保存失败')
      }
    } else {
      const res = await adminFetch('/api/categories/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        showToast('新建年级成功')
        showGradeModal.value = false
        await loadData()
        emit('changed')
      } else {
        const data = await res.json()
        alert(data.error || '创建失败')
      }
    }
  } catch (err) {
    console.error('Failed to save grade:', err)
  }
}

async function handleToggleGradeEnabled(grade: GradeItem) {
  try {
    const updatedStatus = !grade.isEnabled
    const res = await adminFetch(`/api/categories/grades/${grade.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: updatedStatus })
    })
    if (res.ok) {
      grade.isEnabled = updatedStatus
      showToast(`「${grade.name}」已${updatedStatus ? '启用' : '停用'}`)
      emit('changed')
    }
  } catch (err) {
    console.error('Failed to toggle grade status:', err)
  }
}

async function handleDeleteGrade(grade: GradeItem) {
  if (grade.teachingCount && grade.teachingCount > 0) {
    alert(`该年级下仍有关联的 ${grade.teachingCount} 本教辅，无法直接删除！请先将教辅调整年级，或直接将此年级设为停用。`)
    return
  }
  if (!confirm(`确定要删除年级「${grade.name}」吗？`)) return

  try {
    const res = await adminFetch(`/api/categories/grades/${grade.id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('年级已删除')
      await loadData()
      emit('changed')
    } else {
      const data = await res.json()
      alert(data.error || '删除失败')
    }
  } catch (err) {
    console.error('Failed to delete grade:', err)
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Top Action Feedback Toast -->
    <div
      v-if="toastMsg"
      class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in w-fit"
    >
      <CheckCircle2 class="w-4 h-4 text-emerald-400" />
      <span>{{ toastMsg }}</span>
    </div>

    <!-- Category Sub-Tabs Nav -->
    <div class="flex items-center justify-between border-b border-[#22283e] pb-3">
      <div class="flex items-center gap-2">
        <button
          @click="activeSubTab = 'course'"
          :class="[
            'category-subtab-btn px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer',
            activeSubTab === 'course'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'is-inactive bg-[#151928] text-slate-400 hover:text-white hover:bg-[#1e2338]'
          ]"
        >
          <BookOpen class="w-4 h-4" />
          <span>课程广场分类 / 难度等级</span>
          <span class="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-mono">
            {{ courseCategories.length }}
          </span>
        </button>

        <button
          @click="activeSubTab = 'teaching'"
          :class="[
            'category-subtab-btn px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer',
            activeSubTab === 'teaching'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'is-inactive bg-[#151928] text-slate-400 hover:text-white hover:bg-[#1e2338]'
          ]"
        >
          <GraduationCap class="w-4 h-4" />
          <span>同步教辅学段与年级分类</span>
          <span class="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-mono">
            {{ schoolLevels.length }} 学段
          </span>
        </button>
      </div>

      <!-- Quick Action Button -->
      <div>
        <button
          v-if="activeSubTab === 'course'"
          @click="openCreateCourseCatModal"
          class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>新建课程分类</span>
        </button>

        <button
          v-else
          @click="openCreateSchoolLevelModal"
          class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>新建学段分类</span>
        </button>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Tab 1: Course Categories (课程分类 / 难度划分) -->
    <!-- ========================================================================= -->
    <div v-if="activeSubTab === 'course'" class="space-y-4">
      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>控制课程广场顶部 Tab 切换按钮展示次序、启用状态及关联课程</span>
        <span class="text-[11px] text-slate-500">次序数字越小越靠前显示</span>
      </div>

      <!-- Categories Table Card -->
      <div class="rounded-2xl bg-[#141826] border border-[#22283e] overflow-hidden">
        <table class="w-full text-left text-xs">
          <thead class="admin-table-head bg-[#101422] text-slate-400 border-b border-[#22283e] text-[11px] uppercase tracking-wider font-semibold">
            <tr>
              <th class="py-3 px-4 w-16 text-center">排序</th>
              <th class="py-3 px-4">分类名称</th>
              <th class="py-3 px-4">英文标识 (Key)</th>
              <th class="py-3 px-4 text-center">关联课程</th>
              <th class="py-3 px-4 text-center">前台展示</th>
              <th class="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="category-tbody divide-y divide-[#1e2438]">
            <tr
              v-for="cat in courseCategories"
              :key="cat.id"
              class="category-table-row hover:bg-[#1a1f33] transition-colors"
            >
              <!-- Order -->
              <td class="py-3.5 px-4 text-center">
                <span class="px-2 py-0.5 rounded font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 text-xs">
                  #{{ cat.orderNum }}
                </span>
              </td>

              <!-- Name -->
              <td class="py-3.5 px-4">
                <div class="font-bold text-slate-100 flex items-center gap-2">
                  <span>{{ cat.name }}</span>
                </div>
              </td>

              <!-- Key -->
              <td class="py-3.5 px-4">
                <span class="category-key-pill font-mono text-slate-400 bg-[#0f1320] px-2 py-0.5 rounded border border-[#1f263d]">
                  {{ cat.catKey }}
                </span>
              </td>

              <!-- Courses Count -->
              <td class="py-3.5 px-4 text-center">
                <span
                  :class="[
                    'px-2 py-0.5 rounded-full text-[11px] font-medium font-mono',
                    cat.courseCount && cat.courseCount > 0
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                      : 'bg-slate-800 text-slate-500'
                  ]"
                >
                  {{ cat.courseCount || 0 }} 门课程
                </span>
              </td>

              <!-- Enabled Status -->
              <td class="py-3.5 px-4 text-center">
                <button
                  @click="handleToggleCourseCatEnabled(cat)"
                  :class="[
                    'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1',
                    cat.isEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'
                  ]"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="cat.isEnabled ? 'bg-emerald-400' : 'bg-slate-500'"></span>
                  <span>{{ cat.isEnabled ? '已启用' : '已停用' }}</span>
                </button>
              </td>

              <!-- Actions -->
              <td class="py-3.5 px-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    @click="openEditCourseCatModal(cat)"
                    class="category-action-btn p-1.5 rounded-lg bg-[#1f263c] hover:bg-[#28324e] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                    title="编辑分类"
                  >
                    <Edit3 class="w-3.5 h-3.5" />
                  </button>
                  <button
                    @click="handleDeleteCourseCat(cat)"
                    class="category-action-btn category-action-btn-del p-1.5 rounded-lg bg-[#1f263c] hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="删除分类"
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
    <!-- Tab 2: Teaching Levels & Grades (两级层级管理) -->
    <!-- ========================================================================= -->
    <div v-else class="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
      <!-- Left Column: School Levels (学段列表) -->
      <div class="md:col-span-5 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-200">一级：学段分类列表</span>
          <span class="text-[11px] text-slate-400">点击切换下级年级</span>
        </div>

        <div class="space-y-2">
          <div
            v-for="lvl in schoolLevels"
            :key="lvl.id"
            @click="selectedLevelKey = lvl.levelKey"
            :class="[
              'school-level-card p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group',
              selectedLevelKey === lvl.levelKey
                ? 'school-level-card-active bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/50 shadow-md'
                : 'bg-[#141826] border-[#22283e] hover:bg-[#1a1f33]'
            ]"
          >
            <div class="flex items-center gap-3">
              <span class="font-mono text-xs font-bold text-amber-400">#{{ lvl.orderNum }}</span>
              <div>
                <div class="font-bold text-slate-100 flex items-center gap-2">
                  <span>{{ lvl.name }}</span>
                  <span class="text-[11px] font-mono text-slate-400">({{ lvl.levelKey }})</span>
                </div>
                <div class="text-[11px] text-slate-400 mt-0.5">
                  包含 {{ lvl.grades?.length || 0 }} 个年级 · 关联 {{ lvl.teachingCount || 0 }} 本教辅
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                @click.stop="handleToggleLevelEnabled(lvl)"
                :class="[
                  'px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer',
                  lvl.isEnabled
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                ]"
              >
                {{ lvl.isEnabled ? '启用' : '停用' }}
              </button>

              <button
                @click.stop="openEditSchoolLevelModal(lvl)"
                class="category-action-btn p-1 rounded-md hover:bg-[#252b41] text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="编辑学段"
              >
                <Edit3 class="w-3.5 h-3.5" />
              </button>

              <button
                @click.stop="handleDeleteSchoolLevel(lvl)"
                class="category-action-btn category-action-btn-del p-1 rounded-md hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="删除学段"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>

              <ChevronRight
                class="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-transform"
                :class="selectedLevelKey === lvl.levelKey ? 'text-indigo-400 translate-x-1' : ''"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Grades under Selected School Level (下属年级管理) -->
      <div class="md:col-span-7 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-200">
              二级：【{{ currentSchoolLevel?.name || '未知学段' }}】下属年级划分
            </span>
            <span class="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-semibold">
              共 {{ currentSchoolLevel?.grades?.length || 0 }} 个年级
            </span>
          </div>

          <button
            @click="openCreateGradeModal"
            class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>新建年级</span>
          </button>
        </div>

        <!-- Grades Table -->
        <div class="rounded-2xl bg-[#141826] border border-[#22283e] overflow-hidden">
          <table class="w-full text-left text-xs">
            <thead class="admin-table-head bg-[#101422] text-slate-400 border-b border-[#22283e] text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th class="py-3 px-4 w-14 text-center">排序</th>
                <th class="py-3 px-4">年级名称</th>
                <th class="py-3 px-4 text-center">数值代号</th>
                <th class="py-3 px-4 text-center">关联教辅</th>
                <th class="py-3 px-4 text-center">前台展示</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="category-tbody divide-y divide-[#1e2438]">
              <tr
                v-if="!currentSchoolLevel?.grades || currentSchoolLevel.grades.length === 0"
                class="text-center py-8"
              >
                <td colspan="6" class="py-12 text-slate-500">
                  当前学段暂未配置年级，点击右上角「新建年级」开始添加
                </td>
              </tr>
              <tr
                v-for="g in currentSchoolLevel?.grades || []"
                :key="g.id"
                class="category-table-row hover:bg-[#1a1f33] transition-colors"
              >
                <td class="py-3 px-4 text-center">
                  <span class="px-2 py-0.5 rounded font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 text-xs">
                    #{{ g.orderNum }}
                  </span>
                </td>

                <td class="py-3 px-4 font-bold text-slate-100">
                  {{ g.name }}
                </td>

                <td class="py-3 px-4 text-center">
                  <span class="category-key-pill font-mono text-slate-400 bg-[#0f1320] px-2 py-0.5 rounded border border-[#1f263d]">
                    grade={{ g.gradeValue }}
                  </span>
                </td>

                <td class="py-3 px-4 text-center">
                  <span
                    :class="[
                      'px-2 py-0.5 rounded-full text-[11px] font-medium font-mono',
                      g.teachingCount && g.teachingCount > 0
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                        : 'bg-slate-800 text-slate-500'
                    ]"
                  >
                    {{ g.teachingCount || 0 }} 本
                  </span>
                </td>

                <td class="py-3 px-4 text-center">
                  <button
                    @click="handleToggleGradeEnabled(g)"
                    :class="[
                      'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1',
                      g.isEnabled
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    ]"
                  >
                    <span class="w-1.5 h-1.5 rounded-full" :class="g.isEnabled ? 'bg-emerald-400' : 'bg-slate-500'"></span>
                    <span>{{ g.isEnabled ? '启用' : '停用' }}</span>
                  </button>
                </td>

                <td class="py-3 px-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      @click="openEditGradeModal(g)"
                      class="category-action-btn p-1.5 rounded-lg bg-[#1f263c] hover:bg-[#28324e] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                      title="编辑年级"
                    >
                      <Edit3 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      @click="handleDeleteGrade(g)"
                      class="category-action-btn category-action-btn-del p-1.5 rounded-lg bg-[#1f263c] hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="删除年级"
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
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: Course Category Create / Edit -->
    <!-- ========================================================================= -->
    <div
      v-if="showCourseCatModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div class="bg-[#141826] border border-[#28304a] w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#22283e] pb-3">
          <h3 class="text-sm font-bold text-white">
            {{ isEditingCourseCat ? '编辑课程分类' : '新建课程分类' }}
          </h3>
          <button @click="showCourseCatModal = false" class="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">分类名称 (前台显示文本)</label>
            <input
              v-model="courseCatForm.name"
              placeholder="例如: 商务口语、零基础..."
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 mb-1">英文编码 Key (唯一英文标识)</label>
            <input
              v-model="courseCatForm.catKey"
              :disabled="isEditingCourseCat"
              placeholder="例如: business, zero, intro..."
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white disabled:opacity-50 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1">
                显示次序 <span class="text-amber-400 font-mono text-[10px]">(1 最前)</span>
              </label>
              <input
                type="number"
                v-model.number="courseCatForm.orderNum"
                min="1"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-amber-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label class="block text-slate-400 mb-1">状态</label>
              <CustomSelect
                v-model="courseCatForm.isEnabled"
                :options="statusOptions"
              />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#22283e]">
          <button
            @click="showCourseCatModal = false"
            class="px-4 py-2 rounded-xl bg-[#1e2338] text-slate-300 text-xs font-medium cursor-pointer"
          >
            取消
          </button>
          <button
            @click="handleSaveCourseCat"
            class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
          >
            {{ isEditingCourseCat ? '保存更改' : '立即创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: School Level Create / Edit -->
    <!-- ========================================================================= -->
    <div
      v-if="showSchoolLevelModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div class="bg-[#141826] border border-[#28304a] w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#22283e] pb-3">
          <h3 class="text-sm font-bold text-white">
            {{ isEditingSchoolLevel ? '编辑学段分类' : '新建学段分类' }}
          </h3>
          <button @click="showSchoolLevelModal = false" class="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">学段名称 (前台显示)</label>
            <input
              v-model="schoolLevelForm.name"
              placeholder="例如: 小学、初中、职高..."
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 mb-1">英文标识 Key (唯一标识)</label>
            <input
              v-model="schoolLevelForm.levelKey"
              :disabled="isEditingSchoolLevel"
              placeholder="例如: primary, junior, senior..."
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white disabled:opacity-50 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1">
                显示次序 <span class="text-amber-400 font-mono text-[10px]">(1 最前)</span>
              </label>
              <input
                type="number"
                v-model.number="schoolLevelForm.orderNum"
                min="1"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-amber-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label class="block text-slate-400 mb-1">状态</label>
              <CustomSelect
                v-model="schoolLevelForm.isEnabled"
                :options="statusOptions"
              />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#22283e]">
          <button
            @click="showSchoolLevelModal = false"
            class="px-4 py-2 rounded-xl bg-[#1e2338] text-slate-300 text-xs font-medium cursor-pointer"
          >
            取消
          </button>
          <button
            @click="handleSaveSchoolLevel"
            class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
          >
            {{ isEditingSchoolLevel ? '保存更改' : '立即创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Modal: Grade Create / Edit -->
    <!-- ========================================================================= -->
    <div
      v-if="showGradeModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div class="bg-[#141826] border border-[#28304a] w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#22283e] pb-3">
          <h3 class="text-sm font-bold text-white">
            {{ isEditingGrade ? '编辑年级' : `新建年级 (归入【${currentSchoolLevel?.name}】)` }}
          </h3>
          <button @click="showGradeModal = false" class="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">年级名称 (例如: 一年级, 高二, 四级)</label>
            <input
              v-model="gradeForm.name"
              placeholder="例如: 一年级"
              class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1">
                年级数值代码 <span class="text-indigo-400 font-mono text-[10px]">(grade)</span>
              </label>
              <input
                type="number"
                v-model.number="gradeForm.gradeValue"
                placeholder="例如: 1"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label class="block text-slate-400 mb-1">
                排序次序 <span class="text-amber-400 font-mono text-[10px]">(1 最前)</span>
              </label>
              <input
                type="number"
                v-model.number="gradeForm.orderNum"
                min="1"
                class="w-full px-3 py-2 rounded-xl bg-[#0e121f] border border-[#252b41] text-amber-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">前台展示状态</label>
            <CustomSelect
              v-model="gradeForm.isEnabled"
              :options="gradeStatusOptions"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#22283e]">
          <button
            @click="showGradeModal = false"
            class="px-4 py-2 rounded-xl bg-[#1e2338] text-slate-300 text-xs font-medium cursor-pointer"
          >
            取消
          </button>
          <button
            @click="handleSaveGrade"
            class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
          >
            {{ isEditingGrade ? '保存更改' : '立即创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
