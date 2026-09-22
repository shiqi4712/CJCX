import { requireSession } from "@/lib/auth";
import { getPendingReviewLogsForExport } from "@/lib/store";

function toCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatExportTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "请先登录" }, { status: 401 });
  }

  const logs = await getPendingReviewLogsForExport(session.role, session.teacherName);
  const rows = [
    ["访问时间", "输入姓名", "匹配学生", "老师", "状态"],
    ...logs.map((log) => [
      formatExportTime(log.queriedAt),
      log.inputStudentName,
      log.matchedStudentName ?? "",
      log.matchedTeacherName ?? "",
      "审核中访问"
    ])
  ];
  const csv = rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n");
  const encodedFilename = encodeURIComponent("审核期访问记录.csv");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pending-review-logs.csv"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store"
    }
  });
}
