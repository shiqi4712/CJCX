"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Overview = {
  stats: {
    studentCount: number;
    teacherCount: number;
    admittedCount: number;
    queriedCount: number;
    pendingCount: number;
  };
  students: Array<{
    id: string;
    studentName: string;
    teacherName: string;
    score: string;
    overallScore: string | null;
    programType: string;
    admission: string;
    queried: boolean;
    queryCount: number;
    lastQuery: string | null;
    preferredCourseTime: string | null;
    published: boolean;
  }>;
  teachers: Array<{
    id: string;
    teacherName: string;
    role: "admin" | "teacher";
    active: boolean;
  }>;
  storageMode: "postgres" | "mysql" | "memory";
  session?: LoginState;
};

type LoginState = {
  teacherName: string;
  role: "admin" | "teacher";
};

export function BackendConsole({ title, defaultAccount }: { title: string; defaultAccount: string }) {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loginState, setLoginState] = useState<LoginState | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshOverview = useCallback(async () => {
    const response = await fetch("/api/admin/overview");
    if (!response.ok) {
      setOverview(null);
      setLoginState(null);
      return;
    }
    const data = (await response.json()) as Overview;
    setOverview(data);
    if (data.session) {
      setLoginState(data.session);
    }
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, password })
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(data.message ?? "登录失败");
      return;
    }

    setLoginState(data);
    await refreshOverview();
  }

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  return (
    <main className="console-shell">
      <section className="console-hero">
        <div>
          <p>学生数据 · 老师账号 · 查询状态 · 方案导出</p>
          <h1>{title}</h1>
          <span>科特班·英才计划录取查询系统</span>
        </div>
      </section>

      {!loginState ? (
        <form className="login-card" onSubmit={handleLogin} autoComplete="off">
          <h2>后台登录</h2>
          <label>
            <span>登录账号</span>
            <input
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              autoComplete="off"
              name="backend-account"
            />
          </label>
          <label>
            <span>登录密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              name="backend-password"
              type="password"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "登录中..." : "登录后台"}
          </button>
          <p>{defaultAccount ? "请输入管理员账号和密码。" : "请输入老师账号和密码。"}</p>
          {message ? <div className="console-message">{message}</div> : null}
        </form>
      ) : (
        <Dashboard loginState={loginState} overview={overview} refreshOverview={refreshOverview} />
      )}
    </main>
  );
}

function Dashboard({
  loginState,
  overview,
  refreshOverview
}: {
  loginState: LoginState;
  overview: Overview | null;
  refreshOverview: () => Promise<void>;
}) {
  const [status, setStatus] = useState("");
  const studentImportRef = useRef<HTMLInputElement>(null);
  const teacherImportRef = useRef<HTMLInputElement>(null);
  const templateRef = useRef<HTMLInputElement>(null);
  const planStudentsRef = useRef<HTMLInputElement>(null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const isAdmin = loginState.role === "admin";
  const teacherRows = overview?.teachers.filter((teacher) => teacher.role === "teacher") ?? [];
  const studentRows = overview?.students ?? [];

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshOverview();
    }, 15_000);

    return () => window.clearInterval(timer);
  }, [refreshOverview]);

  async function uploadFile(endpoint: string, input: HTMLInputElement | null, label: string) {
    const file = input?.files?.[0];
    if (!file) {
      setStatus(`请先选择${label}`);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(endpoint, { method: "POST", body: formData });
    const data = await response.json();

    if (!response.ok) {
      setStatus(data.message ?? `${label}导入失败`);
      return;
    }

    setStatus(`${label}导入完成：新增 ${data.importedCount} 条，更新 ${data.updatedCount ?? 0} 条`);
    await refreshOverview();
  }

  async function mutate(endpoint: string, method: "PATCH" | "DELETE", body?: object) {
    const response = await fetch(endpoint, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message ?? "操作失败");
      return;
    }
    setStatus("操作成功");
    await refreshOverview();
  }

  async function resetQuery(studentId: string, studentName: string) {
    if (!window.confirm(`确认重置 ${studentName} 的查询资格？重置后家长可以重新查询 3 次。`)) {
      return;
    }

    const response = await fetch(`/api/students/${studentId}/reset-query`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message ?? "重置失败");
      return;
    }

    setStatus(`${studentName} 已重置，可重新查询 3 次`);
    await refreshOverview();
  }

  async function bulkDelete(endpoint: string, ids: string[], label: string, onDone: () => void) {
    if (ids.length === 0) {
      setStatus(`请先选择要删除的${label}`);
      return;
    }
    if (!window.confirm(`确认删除选中的 ${ids.length} 条${label}？此操作不可恢复。`)) {
      return;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message ?? `批量删除${label}失败`);
      return;
    }

    onDone();
    setStatus(`已删除 ${data.deletedCount ?? ids.length} 条${label}`);
    await refreshOverview();
  }

  function toggleSelection(id: string, selectedIds: string[], setSelectedIds: (ids: string[]) => void) {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  function toggleAll(ids: string[], selectedIds: string[], setSelectedIds: (ids: string[]) => void) {
    setSelectedIds(selectedIds.length === ids.length ? [] : ids);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  async function exportPlans() {
    const studentsFile = planStudentsRef.current?.files?.[0];
    if (!studentsFile) {
      setStatus("请先上传学生信息表");
      return;
    }

    const template = templateRef.current?.files?.[0];
    const maxFileSize = 10 * 1024 * 1024;
    if (studentsFile.size > maxFileSize || (template && template.size > maxFileSize)) {
      setStatus("单个文件不能超过 10MB");
      return;
    }

    const formData = new FormData();
    if (template) formData.append("template", template);
    formData.append("students", studentsFile);

    setStatus("正在生成个性化学习方案...");
    const response = await fetch("/api/teacher/course-plans/export", { method: "POST", body: formData });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(
        data.message ??
          (response.status === 413 ? "上传文件过大，请压缩文件后重试或联系管理员调整上传限制" : "生成失败")
      );
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "个性化学习方案批量导出.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("已生成并下载个性化学习方案压缩包");
  }

  function exportQueryStatus() {
    const headers = [
      "学生姓名",
      "成绩",
      "综合得分",
      "班级类型",
      "老师",
      "查询状态",
      "查询次数",
      "最近查询",
      "上课时间",
      "录取结果"
    ];
    const rows = studentRows.map((student) => [
      student.studentName,
      student.score,
      student.overallScore ?? "",
      student.programType,
      student.teacherName,
      student.queried ? "已查询" : "未查询",
      String(student.queryCount),
      formatDateTime(student.lastQuery),
      student.preferredCourseTime ?? "",
      student.admission
    ]);
    const csv = [headers, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "学生查询情况.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("已导出学生查询情况");
  }

  const stats = overview?.stats;
  const teacherIds = teacherRows.map((teacher) => teacher.id);
  const studentIds = studentRows.map((student) => student.id);
  const allTeachersSelected = teacherIds.length > 0 && selectedTeacherIds.length === teacherIds.length;
  const allStudentsSelected = studentIds.length > 0 && selectedStudentIds.length === studentIds.length;

  return (
    <section className="dashboard">
      <header className="dashboard-head">
        <div>
          <h2>{loginState.role === "admin" ? "管理后台" : "老师工作台"}</h2>
          <p>{loginState.teacherName} · {loginState.role === "admin" ? "管理员" : "老师"}</p>
        </div>
        <div className="dashboard-actions">
          <button onClick={() => void refreshOverview()}>刷新数据</button>
          <button onClick={logout}>退出登录</button>
        </div>
      </header>

      {overview?.storageMode === "memory" ? (
        <div className="console-message">当前为本地内存模式；部署前配置 DATABASE_URL 后将自动使用数据库。</div>
      ) : null}

      <div className="metric-grid">
        <Metric label="学生总数" value={stats?.studentCount ?? 0} />
        <Metric label="老师数量" value={stats?.teacherCount ?? 0} />
        <Metric label="已录取" value={stats?.admittedCount ?? 0} />
        <Metric label="已查询" value={stats?.queriedCount ?? 0} />
        <Metric label="未查询" value={stats?.pendingCount ?? 0} />
      </div>

      {isAdmin ? (
        <div className="tool-grid">
          <section className="tool-panel">
            <h3>学生成绩信息</h3>
            <p>
              支持 .xlsx 或 .csv，表头为：学生姓名、成绩、老师姓名、班级类型。综合得分由系统自动生成；班级类型可填：英才班、科特班、育才班、特训营。
            </p>
            <input ref={studentImportRef} type="file" accept=".xlsx,.csv" />
            <button onClick={() => uploadFile("/api/admin/students/import", studentImportRef.current, "学生成绩")}>
              导入学生成绩
            </button>
          </section>

          <section className="tool-panel">
            <h3>老师账号</h3>
            <p>支持 .xlsx 或 .csv，表头为：老师姓名、密码。未填密码时默认 bcm666。</p>
            <input ref={teacherImportRef} type="file" accept=".xlsx,.csv" />
            <button onClick={() => uploadFile("/api/admin/teachers/import", teacherImportRef.current, "老师账号")}>
              导入老师账号
            </button>
          </section>
        </div>
      ) : null}

      {isAdmin ? (
        <section className="tool-panel wide">
          <h3>个性化学习方案</h3>
          <p>上传课程方案 `.docx` 和学生信息表（.xlsx/.csv），系统替换学生姓名与成绩后批量导出。</p>
          <div className="file-row">
            <span>课程方案模板</span>
            <input ref={templateRef} type="file" accept=".doc,.docx" />
          </div>
          <div className="file-row">
            <span>学生信息表</span>
            <input ref={planStudentsRef} type="file" accept=".xlsx,.csv" />
          </div>
          <button onClick={exportPlans}>生成并批量导出</button>
        </section>
      ) : null}

      {status ? <div className="console-message success">{status}</div> : null}

      {isAdmin ? (
        <section className="table-panel">
          <div className="table-panel-head">
            <h3>老师账号管理</h3>
            <button
              disabled={selectedTeacherIds.length === 0}
              onClick={() =>
                void bulkDelete("/api/admin/teachers/bulk-delete", selectedTeacherIds, "老师账号", () =>
                  setSelectedTeacherIds([])
                )
              }
            >
              批量删除老师（{selectedTeacherIds.length}）
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="全选老师"
                      checked={allTeachersSelected}
                      type="checkbox"
                      onChange={() => toggleAll(teacherIds, selectedTeacherIds, setSelectedTeacherIds)}
                    />
                  </th>
                  <th>老师姓名</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {teacherRows.map((teacher) => (
                    <tr key={teacher.id}>
                      <td>
                        <input
                          aria-label={`选择老师 ${teacher.teacherName}`}
                          checked={selectedTeacherIds.includes(teacher.id)}
                          type="checkbox"
                          onChange={() => toggleSelection(teacher.id, selectedTeacherIds, setSelectedTeacherIds)}
                        />
                      </td>
                      <td>{teacher.teacherName}</td>
                      <td>{teacher.active ? "启用" : "停用"}</td>
                      <td>
                        <button
                          onClick={() =>
                            mutate(`/api/admin/teachers/${teacher.id}`, "PATCH", { active: !teacher.active })
                          }
                        >
                          {teacher.active ? "停用" : "启用"}
                        </button>
                        <button
                          onClick={() => {
                            const password = window.prompt(`为 ${teacher.teacherName} 设置新密码（至少 6 位）`);
                            if (password) {
                              void mutate(`/api/admin/teachers/${teacher.id}`, "PATCH", { password });
                            }
                          }}
                        >
                          重置密码
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`确认删除老师 ${teacher.teacherName}？其学生将变为未分配。`)) {
                              void mutate(`/api/admin/teachers/${teacher.id}`, "DELETE");
                            }
                          }}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="table-panel">
        <div className="table-panel-head">
          <h3>学生查询状态</h3>
          {isAdmin ? (
            <div className="table-actions">
              <button onClick={exportQueryStatus}>导出查询情况</button>
              <button
                disabled={selectedStudentIds.length === 0}
                onClick={() =>
                  void bulkDelete("/api/admin/students/bulk-delete", selectedStudentIds, "学生成绩", () =>
                    setSelectedStudentIds([])
                  )
                }
              >
                批量删除学员成绩（{selectedStudentIds.length}）
              </button>
            </div>
          ) : null}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {isAdmin ? (
                  <th>
                    <input
                      aria-label="全选学生"
                      checked={allStudentsSelected}
                      type="checkbox"
                      onChange={() => toggleAll(studentIds, selectedStudentIds, setSelectedStudentIds)}
                    />
                  </th>
                ) : null}
                <th>学生姓名</th>
                <th>成绩</th>
                <th>综合得分</th>
                <th>班级类型</th>
                <th>老师</th>
                <th>上课时间</th>
                <th>录取结果</th>
                <th>查询状态</th>
                <th>最近查询</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {studentRows.map((student) => (
                <tr key={student.id}>
                  {isAdmin ? (
                    <td>
                      <input
                        aria-label={`选择学生 ${student.studentName}`}
                        checked={selectedStudentIds.includes(student.id)}
                        type="checkbox"
                        onChange={() => toggleSelection(student.id, selectedStudentIds, setSelectedStudentIds)}
                      />
                    </td>
                  ) : null}
                  <td>{student.studentName}</td>
                  <td>{student.score}</td>
                  <td>{student.overallScore ?? "-"}</td>
                  <td>{student.programType}</td>
                  <td>{student.teacherName}</td>
                  <td>{student.preferredCourseTime ?? "-"}</td>
                  <td>{student.admission}</td>
                  <td className={student.queried ? "done" : "pending"}>
                    {student.queried ? `已查询 ${student.queryCount} 次` : "未查询"}
                  </td>
                  <td>{formatDateTime(student.lastQuery) || "-"}</td>
                  <td>
                    <button onClick={() => void resetQuery(student.id, student.studentName)}>重置查询</button>
                    {loginState.role === "admin" ? (
                      <>
                        <button
                          onClick={() => {
                            const studentName = window.prompt("学生姓名", student.studentName);
                          if (!studentName) return;
                          const score = window.prompt("成绩", student.score);
                          if (!score) return;
                          const programType = window.prompt("班级类型：英才班 / 科特班 / 育才班 / 特训营", student.programType);
                          if (!programType) return;
                          const teacherName = window.prompt("老师姓名", student.teacherName);
                          if (!teacherName) return;
                          void mutate(`/api/admin/students/${student.id}`, "PATCH", {
                            studentName,
                            score,
                            programType,
                            teacherName
                          });
                        }}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() =>
                          mutate(`/api/admin/students/${student.id}`, "PATCH", {
                            published: !student.published
                          })
                        }
                      >
                        {student.published ? "下架" : "发布"}
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`确认删除学生 ${student.studentName}？`)) {
                            void mutate(`/api/admin/students/${student.id}`, "DELETE");
                          }
                        }}
                        >
                          删除
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function toCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}`;
}
