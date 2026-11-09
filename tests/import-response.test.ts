import assert from "node:assert/strict";
import test from "node:test";
import { importResponse } from "../lib/import-response";

test("long imports send heartbeats and only finish with confirmed counts", async () => {
  let finish!: (result: object) => void;
  const response = importResponse(() => new Promise((resolve) => { finish = resolve; }), 5);
  assert.equal(response.headers.get("X-Accel-Buffering"), "no");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = decoder.decode((await reader.read()).value);
  text += decoder.decode((await reader.read()).value);
  assert.equal(text.trim(), "");
  finish({ importedCount: 10, updatedCount: 2 });
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    text += decoder.decode(chunk.value);
  }
  assert.deepEqual(JSON.parse(text), { importedCount: 10, updatedCount: 2 });
});

test("streamed failures never contain success counts", async () => {
  const response = importResponse(async () => { throw new Error("老师账号不存在"); });
  assert.deepEqual(await response.json(), { message: "老师账号不存在" });
});

test("disconnecting the browser does not interrupt the database operation", async () => {
  let finish!: (result: object) => void;
  let completed = false;
  const response = importResponse(async () => {
    const result = await new Promise<object>((resolve) => { finish = resolve; });
    completed = true;
    return result;
  });
  await response.body!.cancel();
  finish({ importedCount: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(completed, true);
});
