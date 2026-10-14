import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { uploadSheet, type SheetUploadProgress } from "../lib/sheet-upload";

class UploadRequest {
  static current: UploadRequest;
  upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void; onload?: () => void } = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  status = 200;
  responseText = "";
  constructor() { UploadRequest.current = this; }
  open() {}
  send() {}
}

function installRequest(context: TestContext) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "XMLHttpRequest");
  Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, writable: true, value: UploadRequest });
  context.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "XMLHttpRequest", descriptor);
    else Reflect.deleteProperty(globalThis, "XMLHttpRequest");
  });
}

test("upload progress waits for import acknowledgement, then returns counts and archive warning", async (context) => {
  installRequest(context);
  const updates: SheetUploadProgress[] = [];
  let completed = false;
  const promise = uploadSheet("/api/admin/students/import", new File(["学生姓名,成绩"], "students.csv"), (progress) => updates.push(progress));
  void promise.then(() => { completed = true; });
  const xhr = UploadRequest.current;
  xhr.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 100 });
  xhr.upload.onload?.();
  await Promise.resolve();
  assert.equal(completed, false);
  assert.deepEqual(updates, [{ phase: "uploading", percent: 40 }, { phase: "processing", percent: 100 }]);
  xhr.responseText = JSON.stringify({ importedCount: 3, updatedCount: 2, archiveWarning: "备份失败" });
  xhr.onload?.();
  assert.deepEqual(await promise, { importedCount: 3, updatedCount: 2, archiveWarning: "备份失败" });
});

test("failed, invalid and interrupted upload responses never report success", async (context) => {
  installRequest(context);
  const scenarios = [
    { status: 400, body: '{"message":"成绩表无有效数据"}', message: /无有效数据/ },
    { status: 502, body: "<html>Bad Gateway</html>", message: /服务器响应异常/ },
    { status: 200, body: "null", message: /未收到有效导入结果/ },
    { status: 200, body: "{}", message: /未收到有效导入结果/ }
  ];
  for (const scenario of scenarios) {
    const promise = uploadSheet("/api/admin/students/import", new File(["test"], "students.csv"), () => {});
    const rejection = assert.rejects(promise, scenario.message);
    const xhr = UploadRequest.current;
    xhr.status = scenario.status;
    xhr.responseText = scenario.body;
    xhr.onload?.();
    await rejection;
  }
  const promise = uploadSheet("/api/admin/students/import", new File(["test"], "students.csv"), () => {});
  const rejection = assert.rejects(promise, /连接中断/);
  UploadRequest.current.onerror?.();
  await rejection;
});
