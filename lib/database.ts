import { Pool } from "pg";
import { hashPassword } from "./passwords";

type SqlClient = {
  query(text: string, values?: unknown[]): Promise<Record<string, unknown>[]>;
};

let client: SqlClient | null = null;
let schemaPromise: Promise<void> | null = null;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function requireDatabaseInProduction() {
  if (process.env.NODE_ENV === "production" && !hasDatabase()) {
    throw new Error("生产环境必须配置 DATABASE_URL");
  }
}

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("未配置 DATABASE_URL");
  if (!client) {
    const pool = new Pool({
      connectionString: url,
      max: 10,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
    });

    client = {
      async query(text, values) {
        const result = await pool.query(text, values);
        return result.rows as Record<string, unknown>[];
      }
    };
  }

  return client;
}

export async function ensureSchema() {
  if (!hasDatabase()) return;
  schemaPromise ??= initializeSchema();
  await schemaPromise;
}

async function initializeSchema() {
  const sql = getSql();

  await sql.query(`
    CREATE TABLE IF NOT EXISTS teacher_accounts (
      id uuid PRIMARY KEY,
      teacher_name varchar(50) NOT NULL UNIQUE,
      password_hash text NOT NULL,
      role varchar(10) NOT NULL CHECK (role IN ('admin', 'teacher')),
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS students (
      id uuid PRIMARY KEY,
      student_name varchar(50) NOT NULL,
      normalized_name varchar(50) NOT NULL,
      teacher_name varchar(50) REFERENCES teacher_accounts(teacher_name) ON UPDATE CASCADE ON DELETE SET NULL,
      score varchar(30) NOT NULL,
      admission varchar(20) NOT NULL,
      class_name varchar(50) NOT NULL,
      detail text NOT NULL,
      advice text NOT NULL,
      queried boolean NOT NULL DEFAULT false,
      query_count integer NOT NULL DEFAULT 0,
      last_query timestamptz,
      published boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(normalized_name, teacher_name)
    )
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS query_logs (
      id uuid PRIMARY KEY,
      input_student_name varchar(50) NOT NULL,
      matched_student_id uuid REFERENCES students(id) ON DELETE SET NULL,
      result_status varchar(20) NOT NULL CHECK (result_status IN ('success', 'not_found')),
      queried_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await sql.query("CREATE INDEX IF NOT EXISTS students_query_idx ON students(normalized_name, published, created_at)");
  await sql.query("CREATE INDEX IF NOT EXISTS students_teacher_idx ON students(teacher_name)");
  await sql.query("CREATE INDEX IF NOT EXISTS query_logs_time_idx ON query_logs(queried_at DESC)");

  const builtIns = [
    ["00000000-0000-4000-8000-000000000001", "xiaohong", "bdsz666"],
    ["00000000-0000-4000-8000-000000000002", "zhiyang", "tt666"],
    ["00000000-0000-4000-8000-000000000003", "zeyu", "ty666"]
  ] as const;

  for (const [id, teacherName, password] of builtIns) {
    const passwordHash = await hashPassword(password);
    await sql.query(
      `INSERT INTO teacher_accounts (id, teacher_name, password_hash, role, active)
       VALUES ($1, $2, $3, 'admin', true)
       ON CONFLICT (teacher_name) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = 'admin',
         active = true`,
      [id, teacherName, passwordHash]
    );
  }
}
