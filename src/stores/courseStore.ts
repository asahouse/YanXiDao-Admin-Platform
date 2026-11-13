import { defineStore } from 'pinia'
import type { CourseItem, LessonItem, CourseCategoryItem } from '../types'
import { adminFetch } from '../utils/adminApi'
import { userFetch } from '../utils/userApi'

export const useCourseStore = defineStore('course', {
  state: () => ({
    courses: [] as CourseItem[],
    teachingMaterials: [] as CourseItem[],
    categories: [] as CourseCategoryItem[],
    lessons: [] as LessonItem[],
    currentCourse: null as CourseItem | null,
    currentLesson: null as LessonItem | null,
    isLoading: false,
  }),
  actions: {
    async fetchCourses(_userId: string = '8723192') {
      try {
        this.isLoading = true
        const res = await userFetch(`/api/courses`)
        if (res.ok) {
          const data: CourseItem[] = await res.json()
          this.courses = data.filter(c => c.type === 'course')
          this.teachingMaterials = data.filter(c => c.type === 'teaching')
        }
      } catch (err) {
        console.error('Failed to fetch courses:', err)
      } finally {
        this.isLoading = false
      }
    },

    async fetchCourseDetails(courseId: string, _userId: string = '8723192') {
      try {
        const res = await userFetch(`/api/courses/${courseId}`)
        if (res.ok) {
          const data = await res.json()
          this.currentCourse = data.course
          this.categories = data.categories || []
          // Update lessons in store
          const existingOtherLessons = this.lessons.filter(l => l.courseId !== courseId)
          this.lessons = [...existingOtherLessons, ...(data.lessons || [])]
          return data
        }
      } catch (err) {
        console.error('Failed to fetch course details:', err)
      }
      return null
    },

    async fetchLesson(lessonId: string): Promise<LessonItem | null> {
      try {
        const res = await fetch(`/api/lessons/${lessonId}`)
        if (res.ok) {
          const lesson: LessonItem = await res.json()
          const idx = this.lessons.findIndex(l => l.id === lessonId)
          if (idx >= 0) {
            this.lessons[idx] = lesson
          } else {
            this.lessons.push(lesson)
          }
          this.currentLesson = lesson
          return lesson
        }
      } catch (err) {
        console.error('Failed to fetch lesson:', err)
      }
      return this.lessons.find(l => l.id === lessonId) || null
    },

    async toggleFavorite(courseId: string, userId: string = '8723192'): Promise<boolean> {
      const course = this.courses.find(c => c.id === courseId) || this.teachingMaterials.find(t => t.id === courseId)
      // Optimistic update
      if (course) {
        course.isFavorite = !course.isFavorite
      }
      if (this.currentCourse && this.currentCourse.id === courseId) {
        this.currentCourse.isFavorite = !this.currentCourse.isFavorite
      }
      try {
        const res = await userFetch(`/api/courses/${courseId}/favorite`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
        if (res.ok) {
          const data = await res.json()
          if (typeof data.isFavorite === 'boolean') {
            if (course) course.isFavorite = data.isFavorite
            if (this.currentCourse && this.currentCourse.id === courseId) {
              this.currentCourse.isFavorite = data.isFavorite
            }
            return data.isFavorite
          }
        }
      } catch (err) {
        console.error('Failed to toggle favorite:', err)
      }
      return course ? course.isFavorite : false
    },

    async createCourse(payload: {
      type: 'course' | 'teaching'
      title: string
      instructorName?: string
      category?: string
      schoolLevel?: string
      grade?: number
      cover?: string
      lessonCount?: number
      orderNum?: number
    }) {
      const res = await adminFetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        await this.fetchCourses()
      }
      return result
    },

    async updateCourse(courseId: string, payload: {
      title?: string
      instructorName?: string
      instructorAvatar?: string
      cover?: string
      category?: string
      schoolLevel?: string
      grade?: number
      orderNum?: number
    }) {
      const res = await adminFetch(`/api/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        await this.fetchCourses()
        if (this.currentCourse && this.currentCourse.id === courseId) {
          await this.fetchCourseDetails(courseId)
        }
      }
      return result
    },

    async deleteCourse(courseId: string) {
      const res = await adminFetch(`/api/courses/${courseId}`, { method: 'DELETE' })
      const result = await res.json()
      if (res.ok && result.success) {
        this.courses = this.courses.filter(c => c.id !== courseId)
        this.teachingMaterials = this.teachingMaterials.filter(t => t.id !== courseId)
      }
      return result
    },

    async fetchCategories(courseId: string): Promise<CourseCategoryItem[]> {
      const res = await fetch(`/api/courses/${courseId}/categories`)
      if (res.ok) {
        const data = await res.json()
        this.categories = data
        return data
      }
      return []
    },

    async createCategory(courseId: string, name: string) {
      const res = await adminFetch(`/api/courses/${courseId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        await this.fetchCategories(courseId)
      }
      return result
    },

    async deleteCategory(categoryId: string, courseId?: string) {
      const res = await adminFetch(`/api/categories/${categoryId}`, { method: 'DELETE' })
      const result = await res.json()
      if (res.ok && result.success && courseId) {
        await this.fetchCategories(courseId)
      }
      return result
    },

    async fetchCourseLessons(courseId: string): Promise<LessonItem[]> {
      try {
        const res = await fetch(`/api/courses/${courseId}/lessons`)
        if (res.ok) {
          const data: LessonItem[] = await res.json()
          return data
        }
      } catch (err) {
        console.error('Failed to fetch course lessons:', err)
      }
      return []
    },

    async createLesson(courseId: string, payload: {
      lessonNumber?: number
      titleEn?: string
      titleCn?: string
      practiceTimeSeconds?: number
      txtContent?: string
    }) {
      try {
        const res = await adminFetch(`/api/courses/${courseId}/lessons`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (res.ok && result.success) {
          await this.fetchCourses()
          await this.fetchCourseDetails(courseId)
        }
        return result
      } catch (err: any) {
        return { success: false, errorMessage: err.message }
      }
    },

    async updateLesson(lessonId: string, payload: {
      lessonNumber?: number
      titleEn?: string
      titleCn?: string
      practiceTimeSeconds?: number
      courseId?: string
    }) {
      try {
        const res = await adminFetch(`/api/lessons/${lessonId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (res.ok && payload.courseId) {
          await this.fetchCourseDetails(payload.courseId)
        }
        return result
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    },

    async importDataToLesson(lessonId: string, payload: {
      txtContent: string
      practiceTimeSeconds?: number
      titleEn?: string
      titleCn?: string
      courseId?: string
    }) {
      try {
        const res = await adminFetch(`/api/lessons/${lessonId}/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (res.ok && result.success) {
          await this.fetchCourses()
          if (payload.courseId) {
            await this.fetchCourseDetails(payload.courseId)
          }
        }
        return result
      } catch (err: any) {
        return { success: false, errorMessage: err.message }
      }
    },

    async fetchCategoryLessons(categoryId: string): Promise<LessonItem[]> {
      try {
        const res = await fetch(`/api/categories/${categoryId}/lessons`)
        if (res.ok) {
          const data: LessonItem[] = await res.json()
          return data
        }
      } catch (err) {
        console.error('Failed to fetch category lessons:', err)
      }
      return []
    },

    async deleteLesson(lessonId: string, courseId?: string) {
      try {
        const res = await adminFetch(`/api/lessons/${lessonId}`, { method: 'DELETE' })
        const result = await res.json()
        if (res.ok && result.success) {
          this.lessons = this.lessons.filter(l => l.id !== lessonId)
          if (courseId) {
            await this.fetchCourseDetails(courseId)
            await this.fetchCourses()
          }
        }
        return result
      } catch (err) {
        console.error('Failed to delete lesson:', err)
        return { success: false, error: err }
      }
    },

    async importLessonToCategory(categoryId: string, data: {
      courseId: string
      lessonTitleEn?: string
      lessonTitleCn?: string
      txtContent: string
      practiceTimeSeconds?: number
    }) {
      const res = await fetch(`/api/categories/${categoryId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        await this.fetchCourses()
        if (data.courseId) {
          await this.fetchCourseDetails(data.courseId)
        }
      }
      return result
    },

    async completeLesson(lessonId: string, durationSeconds = 60) {
      const lesson = this.lessons.find(l => l.id === lessonId)
      if (lesson) {
        lesson.completedCount += 1
      }
      try {
        await userFetch(`/api/lessons/${lessonId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ durationSeconds }),
        })
      } catch (err) {
        console.error('Failed to mark lesson complete:', err)
      }
    },

    getCourseById(courseId: string) {
      return this.courses.find(c => c.id === courseId) || this.teachingMaterials.find(t => t.id === courseId)
    },

    getLessonsByCourseId(courseId: string) {
      return this.lessons.filter(l => l.courseId === courseId)
    },

    getLessonById(lessonId: string) {
      return this.lessons.find(l => l.id === lessonId)
    },
  },
})
