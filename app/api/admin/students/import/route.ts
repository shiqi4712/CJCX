import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { parseSheetFile, toStudentRows } from "@/lib/sheets";
import { importStudents } from "@/lib/store";

export async function POST(request: Request) {
  const session = await requireSession("admin");
  if (!session) {
    return NextResponse.json({ message: "无管理员权限" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "请上传学生成绩表" }, { status: 400 });
  }

  const parsedRows = await parseSheetFile(file).catch((error: Error) => error);
  if (parsedRows instanceof Error) {
    return NextResponse.json({ message: parsedRows.message }, { status: 400 });
  }

  const rows = toStudentRows(parsedRows);
  if (rows.length === 0) {
    return NextResponse.json({ message: "表头必须包含：学生姓名、成绩" }, { status: 400 });
  }

  return NextResponse.json(importStudents(rows));
}
