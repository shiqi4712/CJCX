import { DOMParser, type Element as XmlElement } from "@xmldom/xmldom";
import JSZip from "jszip";
import { parseCoursePlanLine } from "./course-plan-config";
import type { SheetStudentRow, SheetTeacherRow } from "./types";

type RecordRow = Record<string, unknown>;
type CellValue = string | number | boolean | null;

export function isSheetFile(value: unknown): value is File {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { name?: unknown; size?: unknown; arrayBuffer?: unknown };
  return (
    typeof candidate.name === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
}

export async function parseSheetFile(file: File): Promise<RecordRow[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv")) {
    return parseCsv(buffer.toString("utf8"));
  }

  if (!lowerName.endsWith(".xlsx")) {
    throw new Error("当前支持 .xlsx 或 .csv 文件，请将旧版 .xls 另存为 .xlsx 后上传");
  }

  return matrixToRecords(await parseXlsx(buffer));
}

function parseCsv(text: string): RecordRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  return matrixToRecords(rows);
}

function matrixToRecords(rows: unknown[][]): RecordRow[] {
  const [header = [], ...body] = rows;
  const keys = header.map((cell) => String(cell ?? "").trim());

  return body.map((row) =>
    keys.reduce<RecordRow>((record, key, index) => {
      if (key) {
        record[key] = row[index] ?? "";
      }
      return record;
    }, {})
  );
}

async function parseXlsx(buffer: Buffer): Promise<CellValue[][]> {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await readSharedStrings(zip);
  const sheetPath = await findFirstSheetPath(zip);
  const sheetXml = await zip.file(sheetPath)?.async("string");

  if (!sheetXml) {
    throw new Error("未找到 Excel 工作表内容");
  }

  const doc = parseXml(sheetXml);
  const rowNodes = Array.from(doc.getElementsByTagName("row"));

  return rowNodes.map((rowNode) => {
    const values: CellValue[] = [];
    const cellNodes = Array.from(rowNode.getElementsByTagName("c"));

    for (const cellNode of cellNodes) {
      const ref = cellNode.getAttribute("r") ?? "";
      const columnIndex = getColumnIndex(ref);
      values[columnIndex] = readCellValue(cellNode, sharedStrings);
    }

    return values.map((value) => value ?? "");
  });
}

async function readSharedStrings(zip: JSZip) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (!xml) return [];

  const doc = parseXml(xml);
  return Array.from(doc.getElementsByTagName("si")).map((item) =>
    Array.from(item.getElementsByTagName("t"))
      .map((textNode) => textNode.textContent ?? "")
      .join("")
  );
}

async function findFirstSheetPath(zip: JSZip) {
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");

  if (!workbookXml || !relsXml) {
    return "xl/worksheets/sheet1.xml";
  }

  const workbookDoc = parseXml(workbookXml);
  const firstSheet = workbookDoc.getElementsByTagName("sheet")[0];
  const relId = firstSheet?.getAttribute("r:id");

  if (!relId) {
    return "xl/worksheets/sheet1.xml";
  }

  const relsDoc = parseXml(relsXml);
  const relationships = Array.from(relsDoc.getElementsByTagName("Relationship"));
  const target = relationships.find((rel) => rel.getAttribute("Id") === relId)?.getAttribute("Target");

  if (!target) {
    return "xl/worksheets/sheet1.xml";
  }

  return target.startsWith("xl/") ? target : `xl/${target.replace(/^\/+/, "")}`;
}

function readCellValue(cellNode: XmlElement, sharedStrings: string[]): CellValue {
  const type = cellNode.getAttribute("t");
  const valueNode = cellNode.getElementsByTagName("v")[0];
  const inlineTextNode = cellNode.getElementsByTagName("t")[0];
  const raw = valueNode?.textContent ?? inlineTextNode?.textContent ?? "";

  if (type === "s") {
    return sharedStrings[Number(raw)] ?? "";
  }

  if (type === "inlineStr" || type === "str") {
    return raw;
  }

  if (type === "b") {
    return raw === "1";
  }

  return raw;
}

function getColumnIndex(cellRef: string) {
  const letters = cellRef.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseXml(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

export function toStudentRows(rows: RecordRow[]): SheetStudentRow[] {
  return rows
    .map((row) => {
      const warZoneValue = getRowValue(row, ["战区", "战区名称"]);
      const courseLineValue = getRowValue(row, ["课线", "课程线", "课程课线"]);
      return {
        studentName: String(getRowValue(row, ["学生姓名", "学员姓名", "姓名"]) ?? "").trim(),
        score: String(getRowValue(row, ["成绩", "等级", "录取成绩"]) ?? "").trim(),
        overallScore:
          String(getRowValue(row, ["综合得分", "分数", "得分", "综合分数", "总分"]) ?? "").trim() || null,
        teacherName: String(getRowValue(row, ["老师姓名", "老师", "教师姓名", "负责老师"]) ?? "未分配老师").trim() || "未分配老师",
        programType:
          String(getRowValue(row, ["班级类型", "班型", "录取班级", "班级", "项目类型"]) ?? "").trim() ||
          undefined,
        courseLine: parseCoursePlanLine(courseLineValue === undefined ? undefined : String(courseLineValue)),
        ...(warZoneValue !== undefined ? { warZone: String(warZoneValue).trim() } : {}),
        homeworkLessonCount: toNonNegativeInteger(
          getRowValue(row, [
            "提交作业课次数",
            "提交作业次数",
            "作业提交次数",
            "作业次数",
            "提交作业数",
            "作业课次数",
            "作业数量"
          ])
        ),
        videoCount: toNonNegativeInteger(
          getRowValue(row, ["录制视频次数", "视频录制次数", "录视频次数", "视频次数", "录制视频数", "视频数量"])
        ),
        messageCount: toNonNegativeInteger(
          getRowValue(row, ["学生消息数", "消息条数", "互动消息数", "消息数", "消息数量", "学生消息数量"])
        )
      };
    })
    .filter((row) => row.studentName && row.score);
}

function getRowValue(row: RecordRow, aliases: string[]) {
  for (const alias of aliases) {
    if (row[alias] !== undefined) return row[alias];
  }

  const normalizedAliases = aliases.map(normalizeHeader);
  const entry = Object.entries(row).find(([key]) => normalizedAliases.includes(normalizeHeader(key)));
  return entry?.[1];
}

function normalizeHeader(value: string) {
  return value
    .replace(/[（(].*?[）)]/gu, "")
    .replace(/\s+/gu, "")
    .replace(/[^\p{L}\p{N}%+]/gu, "")
    .toLowerCase();
}

function toNonNegativeInteger(value: unknown) {
  const match = String(value ?? "")
    .trim()
    .match(/\d+(?:\.\d+)?/);
  const numeric = match ? Number(match[0]) : 0;
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

export function toTeacherRows(rows: RecordRow[]): SheetTeacherRow[] {
  return rows
    .map((row) => ({
      teacherName: String(row["老师姓名"] ?? "").trim(),
      password: String(row["密码"] ?? "bcm666").trim() || "bcm666"
    }))
    .filter((row) => row.teacherName);
}
