import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { buildCoursePlanZip } from "@/lib/documents";
import { parseSheetFile, toStudentRows } from "@/lib/sheets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ message: "请先登录" }, { status: 401 });
  }

  const formData = await request.formData();
  const templateFile = formData.get("template");
  const studentsFile = formData.get("students");

  if (!(studentsFile instanceof File)) {
    return NextResponse.json({ message: "请上传学生信息表" }, { status: 400 });
  }

  const parsedRows = await parseSheetFile(studentsFile).catch((error: Error) => error);
  if (parsedRows instanceof Error) {
    return NextResponse.json({ message: parsedRows.message }, { status: 400 });
  }

  const students = toStudentRows(parsedRows);
  if (students.length === 0) {
    return NextResponse.json({ message: "学生信息表头必须包含：学生姓名、成绩" }, { status: 400 });
  }

  const zip = await buildCoursePlanZip(templateFile instanceof File ? templateFile : null, students);
  const filename = encodeURIComponent("个性化学习方案批量导出.zip");

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`
    }
  });
}
