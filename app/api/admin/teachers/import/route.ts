import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { archiveUploadedFile } from "@/lib/blob-storage";
import { parseSheetFile, toTeacherRows } from "@/lib/sheets";
import { importTeachers } from "@/lib/store";
import { isValidPassword } from "@/lib/validation";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await requireSession("admin");
  if (!session) {
    return NextResponse.json({ message: "无管理员权限" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "请上传老师账号表" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ message: "文件不能超过 5MB" }, { status: 400 });
  }

  const parsedRows = await parseSheetFile(file).catch((error: Error) => error);
  if (parsedRows instanceof Error) {
    return NextResponse.json({ message: parsedRows.message }, { status: 400 });
  }

  const rows = toTeacherRows(parsedRows);
  if (rows.length === 0) {
    return NextResponse.json({ message: "表头必须包含：老师姓名；密码为空时默认 bcm666" }, { status: 400 });
  }
  if (rows.some((row) => !isValidPassword(row.password))) {
    return NextResponse.json({ message: "老师密码长度必须为 6-128 位" }, { status: 400 });
  }

  try {
    const result = await importTeachers(rows);
    let archiveWarning: string | undefined;
    try {
      await archiveUploadedFile("imports/teachers", file);
    } catch (error) {
      console.error("Failed to archive teacher import", error);
      archiveWarning = "老师账号已导入，但原文件备份失败";
    }
    return NextResponse.json({ ...result, archiveWarning });
  } catch (error) {
    console.error("Teacher import failed", error);
    return NextResponse.json(
      { message: error instanceof Error ? `老师账号导入失败：${error.message}` : "老师账号导入失败" },
      { status: 500 }
    );
  }
}
