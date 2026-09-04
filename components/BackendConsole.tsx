"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COURSE_PLAN_LINES,
  normalizeCoursePlanLine,
  type CoursePlanLineId,
  type CoursePlanPayload
} from "@/lib/course-plan-config";

const STUDENT_PAGE_SIZE = 20;
const TEACHER_PAGE_SIZE = 10;
const PENDING_REVIEW_PAGE_SIZE = 10;
const EMPTY_WAR_ZONE = "__empty_war_zone__";

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
    courseLine: CoursePlanLineId;
    warZone: string;
    className: string;
    admission: string;
    queried: boolean;
    queryCount: number;
    lastQuery: string | null;
    preferredCourseTime: string | null;
    homeworkLessonCount: number;
    videoCount: number;
    messageCount: number;
    published: boolean;
  }>;
  teachers: Array<{
    id: string;
    teacherName: string;
    role: "admin" | "teacher";
    active: boolean;
  }>;
  queryLogs: Array<{
    id: string;
    inputStudentName: string;
    matchedStudentId: string | null;
    matchedStudentName: string | null;
    matchedTeacherName: string | null;
    resultStatus: "success" | "not_found" | "pending_review";
    queriedAt: string;
  }>;
  coursePlanLinks: Array<{
    id: string;
    studentId: string;
    studentName: string;
    teacherName: string;
    courseLine: string;
    targetClass: string;
    planUrl: string;
    generatedBy: string;
    generatedAt: string;
  }>;
  settings: {
    resultOpenAt: string | null;
  };
  storageMode: "postgres" | "mysql" | "memory";
  session?: LoginState;
};

type LoginState = {
  teacherName: string;
  role: "admin" | "teacher";
};

export function BackendConsole({
  title,
  defaultAccount,
  defaultPassword = ""
}: {
  title: string;
  defaultAccount: string;
  defaultPassword?: string;
}) {
  const [account, setAccount] = useState(defaultAccount);
  const [password, setPassword] = useState(defaultPassword);
  const [loginState, setLoginState] = useState<LoginState | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const autoLoginAttempted = useRef(false);

  const refreshOverview = useCallback(async () => {
    const response = await fetch("/api/admin/overview");
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        setOverview(null);
        setLoginState(null);
      }
      return;
    }
    const data = (await readResponseJson(response)) as Overview;
    setOverview(data);
    if (data.session) {
      setLoginState(data.session);
    }
  }, []);

  const loginWithCredentials = useCallback(
    async (loginAccount: string, loginPassword: string) => {
      setLoading(true);
      setMessage("");

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: loginAccount, password: loginPassword })
      });
      const data = await readResponseJson(response);
      setLoading(false);

      if (!response.ok) {
        setMessage(data.message ?? "登录失败");
        return;
      }

      setLoginState(data as LoginState);
      await refreshOverview();
    },
    [refreshOverview]
  );

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loginWithCredentials(account, password);
  }

  useEffect(() => {
    if (loginState || autoLoginAttempted.current || typeof window === "undefined") return;
    if (!["127.0.0.1", "localhost"].includes(window.location.hostname)) return;

    const params = new URLSearchParams(window.location.search);
    const queryAccount = params.get("backend-account")?.trim() ?? "";
    const queryPassword = params.get("backend-password") ?? "";
    const loginAccount = queryAccount || defaultAccount;
    const loginPassword = queryPassword || defaultPassword;

    if (!loginAccount || !loginPassword) return;
    autoLoginAttempted.current = true;
    setAccount(loginAccount);
    void loginWithCredentials(loginAccount, loginPassword).then(() => {
      if (queryAccount || queryPassword) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    });
  }, [defaultAccount, defaultPassword, loginState, loginWithCredentials]);

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
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [teacherPage, setTeacherPage] = useState(1);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentWarZone, setStudentWarZone] = useState("all");
  const [studentPage, setStudentPage] = useState(1);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentScore, setNewStudentScore] = useState("");
  const [newStudentProgramType, setNewStudentProgramType] = useState("");
  const [newStudentCourseLine, setNewStudentCourseLine] = useState<CoursePlanLineId>("moon");
  const [newStudentHomeworkLessonCount, setNewStudentHomeworkLessonCount] = useState("");
  const [newStudentVideoCount, setNewStudentVideoCount] = useState("");
  const [newStudentMessageCount, setNewStudentMessageCount] = useState("");
  const [resultOpenAtInput, setResultOpenAtInput] = useState("");
  const [planGenerating, setPlanGenerating] = useState(false);
  const [pendingReviewLogs, setPendingReviewLogs] = useState<Overview["queryLogs"]>([]);
  const [pendingReviewPage, setPendingReviewPage] = useState(1);
  const [pendingReviewTotal, setPendingReviewTotal] = useState(0);
  const [pendingReviewPageCount, setPendingReviewPageCount] = useState(1);
  const [pendingReviewLoading, setPendingReviewLoading] = useState(false);
  const [pendingReviewExporting, setPendingReviewExporting] = useState(false);
  const isAdmin = loginState.role === "admin";
  const teacherRows = useMemo(
    () => overview?.teachers.filter((teacher) => teacher.role === "teacher") ?? [],
    [overview?.teachers]
  );
  const teacherPageCount = Math.max(1, Math.ceil(teacherRows.length / TEACHER_PAGE_SIZE));
  const visibleTeacherRows = useMemo(() => {
    const start = (teacherPage - 1) * TEACHER_PAGE_SIZE;
    return teacherRows.slice(start, start + TEACHER_PAGE_SIZE);
  }, [teacherRows, teacherPage]);
  const studentRows = overview?.students ?? [];
  const normalizedStudentSearch = studentSearch.trim().toLowerCase();
  const warZoneOptions = useMemo(() => {
    const counts = new Map<string, number>();
    studentRows.forEach((student) => {
      const key = student.warZone.trim() || EMPTY_WAR_ZONE;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [
      { value: "all", label: "全部战区", count: studentRows.length },
      ...Array.from(counts.entries())
        .sort(([left], [right]) => {
          if (left === EMPTY_WAR_ZONE) return 1;
          if (right === EMPTY_WAR_ZONE) return -1;
          return left.localeCompare(right, "zh-CN");
        })
        .map(([value, count]) => ({
          value,
          label: value === EMPTY_WAR_ZONE ? "未设置战区" : value,
          count
        }))
    ];
  }, [studentRows]);
  const selectedWarZoneRows = useMemo(
    () =>
      studentRows.filter(
        (student) =>
          studentWarZone === "all" ||
          (studentWarZone === EMPTY_WAR_ZONE ? !student.warZone.trim() : student.warZone === studentWarZone)
      ),
    [studentRows, studentWarZone]
  );
  const filteredStudentRows = useMemo(
    () =>
      selectedWarZoneRows.filter(
        (student) =>
          !normalizedStudentSearch || student.studentName.toLowerCase().includes(normalizedStudentSearch)
      ),
    [normalizedStudentSearch, selectedWarZoneRows]
  );
  const studentPageCount = Math.max(1, Math.ceil(filteredStudentRows.length / STUDENT_PAGE_SIZE));
  const visibleStudentRows = useMemo(() => {
    const start = (studentPage - 1) * STUDENT_PAGE_SIZE;
    return filteredStudentRows.slice(start, start + STUDENT_PAGE_SIZE);
  }, [filteredStudentRows, studentPage]);
  const totalQueryCount = selectedWarZoneRows.reduce((sum, student) => sum + student.queryCount, 0);
  const queryRate = statsPercent(
    selectedWarZoneRows.filter((student) => student.queried).length,
    selectedWarZoneRows.length
  );
  const selectedStats = {
    studentCount: selectedWarZoneRows.length,
    admittedCount: selectedWarZoneRows.filter((student) => student.admission === "已录取").length,
    queriedCount: selectedWarZoneRows.filter((student) => student.queried).length,
    pendingCount: selectedWarZoneRows.filter((student) => !student.queried).length
  };
  const selectedWarZoneLabel =
    warZoneOptions.find((option) => option.value === studentWarZone)?.label ?? "全部战区";
  const coursePlanLinkRows = overview?.coursePlanLinks ?? [];

  const refreshPendingReviewLogs = useCallback(async (page: number) => {
    setPendingReviewLoading(true);
    try {
      const response = await fetch(`/api/query-logs/pending-review?page=${page}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as {
        rows: Overview["queryLogs"];
        total: number;
        page: number;
        pageCount: number;
      };
      setPendingReviewLogs(data.rows);
      setPendingReviewTotal(data.total);
      setPendingReviewPageCount(data.pageCount);
      if (data.page !== page) setPendingReviewPage(data.page);
    } finally {
      setPendingReviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPendingReviewLogs(pendingReviewPage);
    const timer = window.setInterval(() => {
      void refreshOverview();
      void refreshPendingReviewLogs(pendingReviewPage);
    }, 15_000);

    return () => window.clearInterval(timer);
  }, [pendingReviewPage, refreshOverview, refreshPendingReviewLogs]);

  useEffect(() => {
    setStudentPage(1);
  }, [normalizedStudentSearch, studentWarZone]);

  useEffect(() => {
    if (studentWarZone !== "all" && !warZoneOptions.some((option) => option.value === studentWarZone)) {
      setStudentWarZone("all");
    }
  }, [studentWarZone, warZoneOptions]);

  useEffect(() => {
    if (studentPage > studentPageCount) {
      setStudentPage(studentPageCount);
    }
  }, [studentPage, studentPageCount]);

  useEffect(() => {
    if (teacherPage > teacherPageCount) {
      setTeacherPage(teacherPageCount);
    }
  }, [teacherPage, teacherPageCount]);

  useEffect(() => {
    setResultOpenAtInput(toDateTimeLocalValue(overview?.settings.resultOpenAt ?? null));
  }, [overview?.settings.resultOpenAt]);

  async function uploadFile(endpoint: string, input: HTMLInputElement | null, label: string) {
    const file = input?.files?.[0];
    if (!file) {
      setStatus(`请先选择${label}`);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(endpoint, { method: "POST", body: formData });
    const data = await readResponseJson(response);

    if (!response.ok) {
      setStatus(data.message ?? `${label}导入失败`);
      return;
    }

    setStatus(
      `${label}导入完成：新增 ${data.importedCount} 条，更新 ${data.updatedCount ?? 0} 条，自动生成方案 ${
        data.generatedPlanCount ?? 0
      } 条${data.archiveWarning ? `；${data.archiveWarning}` : ""}`
    );
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
      if (method === "DELETE" && endpoint.startsWith("/api/admin/students/")) {
        await refreshPendingReviewLogs(pendingReviewPage);
      }
    }

  async function addSingleStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const studentName = newStudentName.trim();
    const score = newStudentScore.trim();
    if (!studentName || !score) {
      setStatus("请填写学生姓名和学生成绩");
      return;
    }

    const response = await fetch("/api/teacher/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName,
        score,
        programType: newStudentProgramType,
        courseLine: newStudentCourseLine,
        homeworkLessonCount: newStudentHomeworkLessonCount,
        videoCount: newStudentVideoCount,
        messageCount: newStudentMessageCount
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message ?? "添加学生失败");
      return;
    }

    setNewStudentName("");
    setNewStudentScore("");
    setNewStudentProgramType("");
    setNewStudentCourseLine("moon");
    setNewStudentHomeworkLessonCount("");
    setNewStudentVideoCount("");
    setNewStudentMessageCount("");
    setStatus(`${studentName} 已添加，学习方案链接已自动生成`);
    await refreshOverview();
  }

  async function saveResultOpenAt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resultOpenAt = resultOpenAtInput ? new Date(resultOpenAtInput).toISOString() : null;
    await saveQueryReleaseSettings(resultOpenAt);
  }

  async function clearResultOpenAt() {
    setResultOpenAtInput("");
    await saveQueryReleaseSettings(null);
  }

  async function saveQueryReleaseSettings(resultOpenAt: string | null) {
    const response = await fetch("/api/admin/settings/query-release", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultOpenAt })
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message ?? "开放查询时间保存失败");
      return;
    }

    setStatus(resultOpenAt ? `已设置开放查询时间：${formatDateTime(resultOpenAt)}` : "已清空开放时间，家长可立即查询");
    await refreshOverview();
  }

  async function resetQuery(studentId: string, studentName: string) {
    if (!window.confirm(`确认重置 ${studentName} 的查询资格？重置后家长可以重新查询 8 次。`)) {
      return;
    }

    const response = await fetch(`/api/students/${studentId}/reset-query`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message ?? "重置失败");
      return;
    }

    setStatus(`${studentName} 已重置，可重新查询 8 次`);
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
    await refreshPendingReviewLogs(pendingReviewPage);
  }

  async function deleteAllStudentRows() {
    if (studentRows.length === 0) {
      setStatus("当前没有可删除的学生名单");
      return;
    }
    if (
      !window.confirm(
        `确认删除全部 ${studentRows.length} 条学生名单？全部审核期访问记录也会一并删除，此操作不可恢复，但不会删除老师账号。`
      )
    ) {
      return;
    }

    const response = await fetch("/api/admin/students/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteAll: true })
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message ?? "删除全部学生名单失败");
      return;
    }

    setStudentPage(1);
    setPendingReviewPage(1);
    setStatus(`已删除全部学生名单及审核期访问记录：${data.deletedCount ?? studentRows.length} 条学生`);
    await refreshOverview();
    await refreshPendingReviewLogs(1);
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

  function exportQueryStatus() {
    const headers = [
      "学生姓名",
      "成绩",
      "综合得分",
      "班级类型",
      "课线",
      "战区",
      "老师",
      "查询状态",
      "查询次数",
      "最近查询",
      "上课时间",
      "作业次数",
      "视频次数",
      "学生消息数",
      "录取结果"
    ];
    const rows = studentRows.map((student) => [
      student.studentName,
      student.score,
      student.overallScore ?? "",
      student.className,
      COURSE_PLAN_LINES[student.courseLine].name,
      student.warZone,
      student.teacherName,
      student.queried ? "已查询" : "未查询",
      String(student.queryCount),
      formatDateTime(student.lastQuery),
      student.preferredCourseTime ?? "",
      String(student.homeworkLessonCount),
      String(student.videoCount),
      String(student.messageCount),
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

  async function exportPendingReviewLogs() {
    setPendingReviewExporting(true);
    try {
      const response = await fetch("/api/query-logs/pending-review/export", { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setStatus(data?.message ?? "审核期访问记录导出失败");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "审核期访问记录.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus(`已导出全部 ${pendingReviewTotal} 条审核期访问记录`);
    } finally {
      setPendingReviewExporting(false);
    }
  }

  function buildStudentCoursePlan(student: Overview["students"][number]) {
    const courseLine = normalizeCoursePlanLine(student.courseLine);
    const line = COURSE_PLAN_LINES[courseLine];
    const targetClass = student.className || line.targetClass;
    const payload: CoursePlanPayload = {
      studentId: student.id,
      student: student.studentName,
      score: student.score,
      courseLine,
      targetClass,
      focus: line.focusDefault,
      goal: line.goalDefault,
      preferredCourseTime: student.preferredCourseTime,
      showPrice: true,
      price: line.price
    };
    return {
      courseLine,
      targetClass,
      planUrl: `${window.location.origin}/course-plan#p=${encodeCoursePlanPayload(payload)}`
    };
  }

  function getStudentPlanLink(student: Overview["students"][number]) {
    return coursePlanLinkRows.find((link) => link.studentId === student.id)?.planUrl ?? "";
  }

  async function saveCoursePlanLink(input: {
    studentId: string;
    courseLine: CoursePlanLineId;
    targetClass: string;
    planUrl: string;
  }) {
    const response = await fetch("/api/teacher/course-plans/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message ?? "方案链接生成失败");
    }
    return data as { planUrl?: string };
  }

  async function ensureStudentPlanLink(student: Overview["students"][number]) {
    const existingPlanUrl = getStudentPlanLink(student);
    if (existingPlanUrl) return existingPlanUrl;

    const built = buildStudentCoursePlan(student);
    const data = await saveCoursePlanLink({
      studentId: student.id,
      courseLine: built.courseLine,
      targetClass: built.targetClass,
      planUrl: built.planUrl
    });
    return data.planUrl ?? built.planUrl;
  }

  async function copyStudentPlanLink(student: Overview["students"][number]) {
    setPlanGenerating(true);
    try {
      const savedUrl = await ensureStudentPlanLink(student);
      await navigator.clipboard.writeText(savedUrl);
      setStatus(`${student.studentName} 的方案链接已复制`);
      await refreshOverview();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "方案链接复制失败");
    } finally {
      setPlanGenerating(false);
    }
  }

  const stats = overview?.stats;
  const visibleTeacherIds = visibleTeacherRows.map((teacher) => teacher.id);
  const allTeachersSelected =
    visibleTeacherIds.length > 0 && visibleTeacherIds.every((id) => selectedTeacherIds.includes(id));

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

      {isAdmin ? (
        <section className="tool-panel wide">
          <h3>成绩开放查询时间</h3>
          <p>
            设置后，家长在该时间之前查询会看到“成绩正在经教学中心审核中 请您耐心等待”；到点后才展示录取结果，提前查询不会计入查询次数。
          </p>
          <form className="single-student-form" onSubmit={saveResultOpenAt}>
            <label>
              <span>开放时间</span>
              <input
                type="datetime-local"
                value={resultOpenAtInput}
                onChange={(event) => setResultOpenAtInput(event.target.value)}
              />
            </label>
            <button type="submit">保存开放时间</button>
            <button type="button" onClick={() => void clearResultOpenAt()}>
              清空并立即开放
            </button>
          </form>
          <p>
            当前设置：
            {overview?.settings.resultOpenAt
              ? `${formatDateTime(overview.settings.resultOpenAt)} 后开放`
              : "未限制，家长可立即查询"}
          </p>
        </section>
      ) : null}

      <section className="metric-overview">
        <div className="metric-overview-head">
          <div>
            <h3>战区数据总览</h3>
            <p>{selectedWarZoneLabel} · 指标与下方学生明细同步</p>
          </div>
          {isAdmin ? (
            <label className="metric-zone-filter">
              <span>选择战区</span>
              <select value={studentWarZone} onChange={(event) => setStudentWarZone(event.target.value)}>
                {warZoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}（{option.count}人）
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="metric-grid">
        <Metric label="学生总数" value={selectedStats.studentCount} />
        {isAdmin ? <Metric label="老师数量" value={stats?.teacherCount ?? 0} /> : null}
        <Metric label="已录取" value={selectedStats.admittedCount} />
        <Metric label="已查询" value={selectedStats.queriedCount} />
        <Metric label={isAdmin ? "当前查询率" : "查询率"} value={queryRate} />
        <Metric label="查询次数" value={totalQueryCount} />
        {isAdmin ? <Metric label="未查询" value={selectedStats.pendingCount} /> : null}
        </div>
      </section>

      {isAdmin ? (
        <div className="tool-grid">
          <section className="tool-panel">
            <h3>学生成绩信息</h3>
            <p>
              支持 .xlsx 或 .csv，表头为：学生姓名、成绩、老师姓名、班级类型、课线、战区、作业次数、视频次数、学生消息数。课线填写 Python、探月或小火箭，用于匹配专属规划、规划明细和时间表物料；综合得分由系统自动生成。班级类型可填：英才特训营、科特班、育才班、特训营；旧表未填写课线时默认使用探月。
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

      <section className="tool-panel wide">
        <h3>单个学员添加</h3>
        <p>{isAdmin ? "仅填写一个学生，添加后默认未分配老师；行为数据留空按 0 计算。" : "仅填写一个学生，添加后自动归属当前老师；行为数据留空按 0 计算。"}</p>
        <form className="single-student-form" onSubmit={addSingleStudent}>
          <label>
            <span>学生姓名</span>
            <input value={newStudentName} onChange={(event) => setNewStudentName(event.target.value)} />
          </label>
          <label>
            <span>学生成绩</span>
            <input value={newStudentScore} onChange={(event) => setNewStudentScore(event.target.value)} placeholder="如 A+ / A / B" />
          </label>
          <label>
            <span>班型</span>
            <input
              value={newStudentProgramType}
              onChange={(event) => setNewStudentProgramType(event.target.value)}
              placeholder="如 英才班 / 特训营"
            />
          </label>
          <label>
            <span>课线</span>
            <select value={newStudentCourseLine} onChange={(event) => setNewStudentCourseLine(event.target.value as CoursePlanLineId)}>
              <option value="python">Python</option>
              <option value="moon">探月</option>
              <option value="rocket">小火箭</option>
            </select>
          </label>
          <label>
            <span>提交作业课次数</span>
            <input
              min="0"
              step="1"
              type="number"
              value={newStudentHomeworkLessonCount}
              onChange={(event) => setNewStudentHomeworkLessonCount(event.target.value)}
              placeholder="如 3"
            />
          </label>
          <label>
            <span>录制视频次数</span>
            <input
              min="0"
              step="1"
              type="number"
              value={newStudentVideoCount}
              onChange={(event) => setNewStudentVideoCount(event.target.value)}
              placeholder="如 1"
            />
          </label>
          <label>
            <span>学生消息数</span>
            <input
              min="0"
              step="1"
              type="number"
              value={newStudentMessageCount}
              onChange={(event) => setNewStudentMessageCount(event.target.value)}
              placeholder="如 45"
            />
          </label>
          <button type="submit">添加学员</button>
        </form>
      </section>

      {status ? <div className="console-message success">{status}</div> : null}

      {isAdmin ? (
        <section className="table-panel">
          <div className="table-panel-head">
            <div>
              <h3>老师账号管理</h3>
              <p>共 {teacherRows.length} 个老师账号，第 {teacherPage} / {teacherPageCount} 页，每页 {TEACHER_PAGE_SIZE} 条</p>
            </div>
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
                      onChange={() => toggleAll(visibleTeacherIds, selectedTeacherIds, setSelectedTeacherIds)}
                    />
                  </th>
                  <th>老师姓名</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleTeacherRows.map((teacher) => (
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
                {visibleTeacherRows.length === 0 ? (
                  <tr>
                    <td colSpan={4}>暂无老师账号</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button disabled={teacherPage <= 1} onClick={() => setTeacherPage((page) => Math.max(1, page - 1))}>
              上一页
            </button>
            <span>
              第 {teacherPage} / {teacherPageCount} 页，每页 {TEACHER_PAGE_SIZE} 条
            </span>
            <button
              disabled={teacherPage >= teacherPageCount}
              onClick={() => setTeacherPage((page) => Math.min(teacherPageCount, page + 1))}
            >
              下一页
            </button>
          </div>
        </section>
      ) : null}

      <section className="table-panel">
        <div className="table-panel-head">
          <div>
            <h3>审核期访问记录</h3>
            <p>家长在成绩开放前点击查询会记录在这里，但不会计入查询次数，也不会改变学生查询状态。</p>
          </div>
          <div className="table-actions">
            <span className="table-count">
              共 {pendingReviewTotal} 条，第 {pendingReviewPage} / {pendingReviewPageCount} 页
            </span>
            <button
              disabled={pendingReviewExporting || pendingReviewTotal === 0}
              onClick={() => void exportPendingReviewLogs()}
            >
              {pendingReviewExporting ? "导出中..." : "导出访问记录"}
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>访问时间</th>
                <th>输入姓名</th>
                <th>匹配学生</th>
                <th>老师</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {pendingReviewLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.queriedAt) || "-"}</td>
                  <td>{log.inputStudentName}</td>
                  <td>{log.matchedStudentName ?? "-"}</td>
                  <td>{log.matchedTeacherName ?? "-"}</td>
                  <td className="pending">审核中访问</td>
                </tr>
              ))}
              {pendingReviewLogs.length === 0 ? (
                <tr>
                  <td colSpan={5}>{pendingReviewLoading ? "正在加载..." : "暂无审核期访问记录"}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button
            disabled={pendingReviewLoading || pendingReviewPage <= 1}
            onClick={() => setPendingReviewPage((page) => Math.max(1, page - 1))}
          >
            上一页
          </button>
          <span>
            第 {pendingReviewPage} / {pendingReviewPageCount} 页，每页 {PENDING_REVIEW_PAGE_SIZE} 条
          </span>
          <button
            disabled={pendingReviewLoading || pendingReviewPage >= pendingReviewPageCount}
            onClick={() => setPendingReviewPage((page) => Math.min(pendingReviewPageCount, page + 1))}
          >
            下一页
          </button>
        </div>
      </section>

      <section className="table-panel">
        <div className="table-panel-head">
          <div>
            <h3>学生名单与方案链接</h3>
            <div className="student-filters">
              <label className="student-search">
                <span>搜索学生</span>
                <input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="输入学生姓名"
                />
              </label>
            </div>
          </div>
          <div className="table-actions">
            <span className="table-count">
              共 {filteredStudentRows.length} 人，第 {studentPage} / {studentPageCount} 页
            </span>
            {isAdmin ? (
              <>
              <button onClick={exportQueryStatus}>导出查询情况</button>
              <button
                disabled={studentRows.length === 0}
                onClick={() => void deleteAllStudentRows()}
              >
                删除全部学生名单
              </button>
              </>
            ) : null}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>学生姓名</th>
                <th>成绩</th>
                <th>综合得分</th>
                <th>班级类型</th>
                <th>课线</th>
                <th>战区</th>
                <th>老师</th>
                <th>上课时间</th>
                <th>作业</th>
                <th>视频</th>
                <th>消息</th>
                <th>录取结果</th>
                <th>查询状态</th>
                <th>最近查询</th>
                <th>方案链接</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudentRows.map((student) => (
                <tr key={student.id}>
                  <td>{student.studentName}</td>
                  <td>{student.score}</td>
                  <td>{student.overallScore ?? "-"}</td>
                  <td>{student.className}</td>
                  <td>{COURSE_PLAN_LINES[student.courseLine].name}</td>
                  <td>{student.warZone || "-"}</td>
                  <td>{student.teacherName}</td>
                  <td>{student.preferredCourseTime ?? "-"}</td>
                  <td>{student.homeworkLessonCount}</td>
                  <td>{student.videoCount}</td>
                  <td>{student.messageCount}</td>
                  <td>{student.admission}</td>
                  <td className={student.queried ? "done" : "pending"}>
                    {student.queried ? `已查询 ${student.queryCount} 次` : "未查询"}
                  </td>
                  <td>{formatDateTime(student.lastQuery) || "-"}</td>
                  <td className={getStudentPlanLink(student) ? "done" : "pending"}>
                    {getStudentPlanLink(student) ? "已生成" : "待补生成"}
                  </td>
                  <td>
                    <button disabled={planGenerating} onClick={() => void copyStudentPlanLink(student)}>
                      复制方案链接
                    </button>
                    <button onClick={() => void resetQuery(student.id, student.studentName)}>重置查询</button>
                    {loginState.role === "admin" ? (
                      <>
                        <button
                          onClick={() => {
                            const studentName = window.prompt("学生姓名", student.studentName);
                          if (!studentName) return;
                          const score = window.prompt("成绩", student.score);
                          if (!score) return;
                          const programType = window.prompt("请输入成绩表中的班型名称", student.className);
                          if (!programType) return;
                          const courseLineInput = window.prompt("课线：Python、探月或小火箭", COURSE_PLAN_LINES[student.courseLine].name);
                          if (!courseLineInput) return;
                          const courseLine = normalizeCoursePlanLine(courseLineInput);
                          const teacherName = window.prompt("老师姓名", student.teacherName);
                          if (!teacherName) return;
                          void mutate(`/api/admin/students/${student.id}`, "PATCH", {
                            studentName,
                            score,
                            programType,
                            courseLine,
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
                          if (window.confirm(`确认删除学生 ${student.studentName}？该学生对应的审核期访问记录也会一并删除。`)) {
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
              {visibleStudentRows.length === 0 ? (
                <tr>
                  <td colSpan={16}>没有匹配的学生</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button disabled={studentPage <= 1} onClick={() => setStudentPage((page) => Math.max(1, page - 1))}>
            上一页
          </button>
          <span>
            第 {studentPage} / {studentPageCount} 页，每页 {STUDENT_PAGE_SIZE} 条
          </span>
          <button
            disabled={studentPage >= studentPageCount}
            onClick={() => setStudentPage((page) => Math.min(studentPageCount, page + 1))}
          >
            下一页
          </button>
        </div>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function statsPercent(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function encodeCoursePlanPayload(payload: CoursePlanPayload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function readResponseJson(response: Response): Promise<Record<string, any>> {
  const text = await response.text();
  if (text) {
    try {
      return JSON.parse(text) as Record<string, any>;
    } catch {
      // Reverse proxies commonly return an HTML error page for 502/504 responses.
    }
  }
  return {
    message:
      response.status >= 500
        ? "服务器暂时繁忙或请求超时，请稍后重试"
        : `请求失败（${response.status}）`
  };
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

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}
