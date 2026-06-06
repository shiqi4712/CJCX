CREATE TABLE teacher_accounts (
  id uuid PRIMARY KEY,
  teacher_name varchar(50) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role varchar(10) NOT NULL CHECK (role IN ('admin', 'teacher')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE students (
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
);

CREATE TABLE query_logs (
  id uuid PRIMARY KEY,
  input_student_name varchar(50) NOT NULL,
  matched_student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  result_status varchar(20) NOT NULL CHECK (result_status IN ('success', 'not_found')),
  queried_at timestamptz NOT NULL DEFAULT now()
);
