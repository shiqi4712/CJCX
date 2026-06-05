"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

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
    admission: string;
    queried: boolean;
    queryCount: number;
    lastQuery: string | null;
  }>;
};

type LoginState = {
  teacherName: string;
  role: "admin" | "teacher";
};

export function BackendConsole({ title, defaultAccount }: { title: string; defaultAccount: string }) {
  const [account, setAccount] = useState(defaultAccount);
  const [password, setPassword] = useState(defaultAccount === "xiaohong" ? "bdsz666" : "bcm666");
  const [loginState, setLoginState] = useState<LoginState | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function refreshOverview() {
    const response = await fetch("/api/admin/overview");
    if (!response.ok) return;
    setOverview(await response.json());
  }

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
    refreshOverview();
  }, []);

  return (
    <main className="console-shell">
      <section className="console-hero">
        <div>
          <p>学生数据 · 老师账号 · 查询状态 · 方案导出</p>
          <h1>{title}</h1>
          <span>英才班录取查询系统</span>
        </div>
      </section>

      {!loginState ? (
        <form className="login-card" onSubmit={handleLogin}>
          <h2>后台登录</h2>
          <label>
            <span>登录账号</span>
            <input value={account} onChange={(event) => setAccount(event.target.value)} />
          </label>
          <label>
            <span>登录密码</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "登录中..." : "登录后台"}
          </button>
          <p>管理员账号：xiaohong / bdsz666；老师账号使用管理员导入的姓名，初始密码 bcm666。</p>
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

    setStatus(`${label}导入成功：${data.importedCount} 条`);
    await refreshOverview();
  }

  async function exportPlans() {
    const studentsFile = planStudentsRef.current?.files?.[0];
    if (!studentsFile) {
      setStatus("请先上传学生信息表");
      return;
    }

    const formData = new FormData();
    const template = templateRef.current?.files?.[0];
    if (template) formData.append("template", template);
    formData.append("students", studentsFile);

    setStatus("正在生成个性化学习方案...");
    const response = await fetch("/api/teacher/course-plans/export", { method: "POST", body: formData });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.message ?? "生成失败");
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

  const stats = overview?.stats;

  return (
    <section className="dashboard">
      <header className="dashboard-head">
        <div>
          <h2>{loginState.role === "admin" ? "管理后台" : "老师工作台"}</h2>
          <p>{loginState.teacherName} · {loginState.role === "admin" ? "管理员" : "老师"}</p>
        </div>
      </header>

      <div className="metric-grid">
        <Metric label="学生总数" value={stats?.studentCount ?? 0} />
        <Metric label="老师数量" value={stats?.teacherCount ?? 0} />
        <Metric label="已录取" value={stats?.admittedCount ?? 0} />
        <Metric label="已查询" value={stats?.queriedCount ?? 0} />
        <Metric label="未查询" value={stats?.pendingCount ?? 0} />
      </div>

      {loginState.role === "admin" ? (
        <div className="tool-grid">
          <section className="tool-panel">
            <h3>学生成绩信息</h3>
            <p>支持 .xlsx 或 .csv，表头固定为：学生姓名、成绩。</p>
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

      {status ? <div className="console-message success">{status}</div> : null}

      <section className="table-panel">
        <h3>学生查询状态</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>学生姓名</th>
                <th>成绩</th>
                <th>老师</th>
                <th>录取结果</th>
                <th>查询状态</th>
                <th>最近查询</th>
              </tr>
            </thead>
            <tbody>
              {overview?.students.map((student) => (
                <tr key={student.id}>
                  <td>{student.studentName}</td>
                  <td>{student.score}</td>
                  <td>{student.teacherName}</td>
                  <td>{student.admission}</td>
                  <td className={student.queried ? "done" : "pending"}>
                    {student.queried ? `已查询 ${student.queryCount} 次` : "未查询"}
                  </td>
                  <td>{student.lastQuery ?? "-"}</td>
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
