/**
 * 一次性数据迁移脚本：将本地 SQLite (data/yanxidao.db) 数据无损导入 MySQL
 * 使用方式：
 *   1. 确保已配置好 MySQL 环境变量（DB_TYPE=mysql DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=yanxidao）
 *   2. 运行: node scripts/migrate-sqlite-to-mysql.mjs
 */
import { DatabaseSync } from 'node:sqlite'
import mysql from 'mysql2/promise'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const SQLITE_PATH = process.env.YANXIDAO_DB_PATH || path.join(PROJECT_ROOT, 'data', 'yanxidao.db')

const MYSQL_CONFIG = {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD ?? process.env.MYSQL_PASSWORD ?? '',
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'yanxidao',
  charset: 'utf8mb4',
}

const TABLES_TO_MIGRATE = [
  'system_meta',
  'admin_users',
  'user_profile',
  'purchase_records',
  'category_courses',
  'category_school_levels',
  'category_grades',
  'courses',
  'course_categories',
  'lessons',
  'sentences',
  'words',
  'tts_dictionary',
  'user_course_progress',
  'user_favorites',
  'user_favorite_sentences',
  'reviews',
  'feedback_reports',
  'email_logs',
  'admin_audit_logs',
]

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`未找到 SQLite 数据库文件: ${SQLITE_PATH}`)
    process.exit(1)
  }

  console.log(`[Migrate] 读取 SQLite: ${SQLITE_PATH}`)
  const sqlite = new DatabaseSync(SQLITE_PATH, { readOnly: true })

  console.log(`[Migrate] 连接 MySQL: ${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}`)
  const conn = await mysql.createConnection(MYSQL_CONFIG)

  try {
    for (const table of TABLES_TO_MIGRATE) {
      let rows = []
      try {
        rows = sqlite.prepare(`SELECT * FROM ${table};`).all()
      } catch {
        console.log(`  - 跳过不存在的表: ${table}`)
        continue
      }
      if (!rows.length) {
        console.log(`  - ${table}: 0 条记录，跳过`)
        continue
      }

      const cols = Object.keys(rows[0])
      const colList = cols.map(c => `\`${c}\``).join(', ')
      const placeholders = cols.map(() => '?').join(', ')
      const updateClause = cols.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ')
      const sql = `INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause};`

      let count = 0
      for (const row of rows) {
        const vals = cols.map(c => (row[c] === undefined ? null : row[c]))
        await conn.query(sql, vals)
        count += 1
      }
      console.log(`  ✓ ${table}: 已迁移 ${count} 条记录`)
    }
    console.log('[Migrate] 全部数据迁移完成！')
  } finally {
    await conn.end()
    sqlite.close()
  }
}

main().catch((err) => {
  console.error('[Migrate] 迁移失败:', err)
  process.exit(1)
})
