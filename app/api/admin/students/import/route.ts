import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { archiveUploadedFile } from "@/lib/blob-storage";
import { createAutomaticCoursePlanLinks } from "@/lib/course-plan-links";
import { isSheetFile, parseSheetFile, toStudentRows } from "@/lib/sheets";
import { getOverview, importStudents } from "@/lib/store";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await requireSession("admin");
    if (!session) {
      return NextResponse.json({ message: "无管理员权限" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!isSheetFile(file)) {
      return NextResponse.json({ message: "请上传学生成绩表" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: "文件不能超过 5MB" }, { status: 400 });
    }

    const parsedRows = await parseSheetFile(file);
    const rows = toStudentRows(parsedRows);
    if (rows.length === 0) {
      return NextResponse.json(
        {
          message:
            "表头为：学生姓名、成绩、老师姓名、班级类型、课线、战区、作业次数、视频次数、学生消息数。学生姓名和成绩必填；课线可填 Python、探月或小火箭。"
        },
        { status: 400 }
      );
    }

    const result = await importStudents(rows);
    const origin = new URL(request.url).origin;
    const overview = await getOverview("admin");
    const generatedPlanCount = await createAutomaticCoursePlanLinks(
      result.affectedStudentIds,
      overview.students,
      origin,
      session.role,
      session.teacherName
    );
    await archiveUploadedFile("imports/students", file);
    return NextResponse.json({ ...result, generatedPlanCount });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "学生成绩导入失败" },
      { status: 400 }
    );
  }
}
