import { Pool as PgPool } from "pg";
import { createPool as createMySqlPool, type Pool as MySqlPool } from "mysql2/promise";
import { hashPassword } from "./passwords";

export type SqlDialect = "postgres" | "mysql";

type QueryResult = {
  rows: Record<string, unknown>[];
  affectedRows: number;
};

type SqlClient = {
  dialect: SqlDialect;
  execute(text: string, values?: unknown[]): Promise<QueryResult>;
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

function getDialect(url: string): SqlDialect {
  const protocol = new URL(url).protocol.replace(":", "");
  return protocol === "mysql" || protocol === "mysql2" ? "mysql" : "postgres";
}

function toMySqlQuery(text: string, values: unknown[] = []) {
  const mysqlValues: unknown[] = [];
  const mysqlText = text.replace(/\$(\d+)/g, (_match, index: string) => {
    mysqlValues.push(values[Number(index) - 1]);
    return "?";
  });
  return {
    text: mysqlText,
    values: mysqlValues.length > 0 ? mysqlValues : values
  };
}

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("未配置 DATABASE_URL");
  if (client) return client;

  const dialect = getDialect(url);
  if (dialect === "mysql") {
    const pool: MySqlPool = createMySqlPool({
      uri: url,
      connectionLimit: Number(process.env.DATABASE_POOL_MAX ?? 10),
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      timezone: "+08:00"
    });

    client = {
      dialect,
      async execute(text, values) {
        const query = toMySqlQuery(text, values ?? []);
        const [result] = await pool.execute(query.text, query.values as never[]);
        return {
          rows: Array.isArray(result) ? (result as Record<string, unknown>[]) : [],
          affectedRows: Array.isArray(result) ? 0 : Number(result.affectedRows ?? 0)
        };
      },
      async query(text, values) {
        return (await this.execute(text, values)).rows;
      }
    };
    return client;
  }

  const pool = new PgPool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });

  client = {
    dialect,
    async execute(text, values) {
      const result = await pool.query(text, values);
      return {
        rows: result.rows as Record<string, unknown>[],
        affectedRows: result.rowCount ?? 0
      };
    },
    async query(text, values) {
      return (await this.execute(text, values)).rows;
    }
  };
  return client;
}

export async function ensureSchema() {
  if (!hasDatabase()) return;
  schemaPromise ??= initializeSchema();
  await schemaPromise;
}

async function initializeSchema() {
  const sql = getSql();

  if (sql.dialect === "mysql") {
    await initializeMySqlSchema(sql);
  } else {
    await initializePostgresSchema(sql);
  }

  await ensureBuiltInAdmins(sql);
}

async function initializePostgresSchema(sql: SqlClient) {
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
      overall_score varchar(30),
      program_type varchar(20) NOT NULL DEFAULT '英才特训营',
      admission varchar(20) NOT NULL,
      class_name varchar(50) NOT NULL,
      detail text NOT NULL,
      advice text NOT NULL,
      queried boolean NOT NULL DEFAULT false,
      query_count integer NOT NULL DEFAULT 0,
      last_query timestamptz,
      preferred_course_time varchar(80),
      published boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(normalized_name, teacher_name)
    )
  `);

  await sql.query("ALTER TABLE students ADD COLUMN IF NOT EXISTS preferred_course_time varchar(80)");
  await sql.query("ALTER TABLE students ADD COLUMN IF NOT EXISTS program_type varchar(20) NOT NULL DEFAULT '英才特训营'");
  await sql.query("ALTER TABLE students ADD COLUMN IF NOT EXISTS overall_score varchar(30)");

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
}

async function initializeMySqlSchema(sql: SqlClient) {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS teacher_accounts (
      id char(36) PRIMARY KEY,
      teacher_name varchar(50) NOT NULL UNIQUE,
      password_hash text NOT NULL,
      role varchar(10) NOT NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CHECK (role IN ('admin', 'teacher'))
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS students (
      id char(36) PRIMARY KEY,
      student_name varchar(50) NOT NULL,
      normalized_name varchar(50) NOT NULL,
      teacher_name varchar(50),
      score varchar(30) NOT NULL,
      overall_score varchar(30),
      program_type varchar(20) NOT NULL DEFAULT '英才特训营',
      admission varchar(20) NOT NULL,
      class_name varchar(50) NOT NULL,
      detail text NOT NULL,
      advice text NOT NULL,
      queried boolean NOT NULL DEFAULT false,
      query_count int NOT NULL DEFAULT 0,
      last_query timestamp(3) NULL,
      preferred_course_time varchar(80),
      published boolean NOT NULL DEFAULT true,
      created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY students_unique_name_teacher (normalized_name, teacher_name),
      CONSTRAINT students_teacher_fk FOREIGN KEY (teacher_name)
        REFERENCES teacher_accounts(teacher_name) ON UPDATE CASCADE ON DELETE SET NULL
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addMySqlColumnIfMissing(sql, "students", "preferred_course_time", "varchar(80)");
  await addMySqlColumnIfMissing(sql, "students", "program_type", "varchar(20) NOT NULL DEFAULT '英才特训营'");
  await addMySqlColumnIfMissing(sql, "students", "overall_score", "varchar(30)");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS query_logs (
      id char(36) PRIMARY KEY,
      input_student_name varchar(50) NOT NULL,
      matched_student_id char(36),
      result_status varchar(20) NOT NULL,
      queried_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CHECK (result_status IN ('success', 'not_found')),
      CONSTRAINT query_logs_student_fk FOREIGN KEY (matched_student_id)
        REFERENCES students(id) ON DELETE SET NULL
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createMySqlIndexIfMissing(sql, "students", "students_query_idx", "normalized_name, published, created_at");
  await createMySqlIndexIfMissing(sql, "students", "students_teacher_idx", "teacher_name");
  await createMySqlIndexIfMissing(sql, "query_logs", "query_logs_time_idx", "queried_at");
}

async function addMySqlColumnIfMissing(sql: SqlClient, tableName: string, columnName: string, definition: string) {
  const rows = await sql.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = $1 AND COLUMN_NAME = $2 LIMIT 1`,
    [tableName, columnName]
  );
  if (rows.length === 0) {
    await sql.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function createMySqlIndexIfMissing(sql: SqlClient, tableName: string, indexName: string, columns: string) {
  const rows = await sql.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = $1 AND INDEX_NAME = $2 LIMIT 1`,
    [tableName, indexName]
  );
  if (rows.length === 0) {
    await sql.query(`CREATE INDEX ${indexName} ON ${tableName} (${columns})`);
  }
}

async function ensureBuiltInAdmins(sql: SqlClient) {
  const builtIns = [
    ["00000000-0000-4000-8000-000000000001", "xiaohong", "bdsz666"],
    ["00000000-0000-4000-8000-000000000002", "zhiyang", "tt666"],
    ["00000000-0000-4000-8000-000000000003", "zeyu", "ty666"],
    ["00000000-0000-4000-8000-000000000004", "jiangxiao", "df666"]
  ] as const;

  for (const [id, teacherName, password] of builtIns) {
    const passwordHash = await hashPassword(password);
    if (sql.dialect === "mysql") {
      await sql.query(
        `INSERT INTO teacher_accounts (id, teacher_name, password_hash, role, active)
         VALUES ($1, $2, $3, 'admin', true)
         ON DUPLICATE KEY UPDATE
           password_hash = VALUES(password_hash),
           role = 'admin',
           active = true`,
        [id, teacherName, passwordHash]
      );
    } else {
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
}
