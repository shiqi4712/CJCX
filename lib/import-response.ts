// JSON permits leading whitespace, so heartbeats remain compatible with upload clients.
export function importResponse(work: () => Promise<object>, heartbeatMs = 10_000) {
  const encoder = new TextEncoder();
  let connected = true;
  let timer: ReturnType<typeof setInterval>;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        if (connected) controller.enqueue(encoder.encode(text));
      };
      send(" ");
      timer = setInterval(() => send(" \n"), heartbeatMs);
      void (async () => {
        try {
          send(JSON.stringify(await work()));
        } catch (error) {
          send(JSON.stringify({ message: error instanceof Error ? error.message : "成绩导入失败" }));
        } finally {
          clearInterval(timer);
          if (connected) controller.close();
        }
      })();
    },
    cancel() {
      connected = false;
      clearInterval(timer);
    }
  });
  return new Response(body, { headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Accel-Buffering": "no"
  } });
}
