export type SheetUploadProgress = { phase: "uploading" | "processing"; percent: number | null };
export type SheetUploadResult = { importedCount: number; updatedCount?: number; archiveWarning?: string };

export function uploadSheet(endpoint: string, file: File, onProgress: (progress: SheetUploadProgress) => void): Promise<SheetUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (event) => onProgress({ phase: "uploading",
      percent: event.lengthComputable ? Math.round(event.loaded / event.total * 100) : null });
    // Completing the transfer is not the same as successfully importing the rows.
    xhr.upload.onload = () => onProgress({ phase: "processing", percent: 100 });
    xhr.onload = () => {
      let result;
      try { result = JSON.parse(xhr.responseText); }
      catch { reject(new Error(`服务器响应异常（${xhr.status}），请刷新数据核对导入结果后再重试。`)); return; }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(result?.message || `导入失败（${xhr.status}）`));
        return;
      }
      if (!result || typeof result.importedCount !== "number" || !Number.isFinite(result.importedCount)) {
        reject(new Error("未收到有效导入结果，请刷新数据核对。"));
        return;
      }
      resolve(result);
    };
    xhr.onerror = () => reject(new Error("连接中断，导入可能仍在进行，请刷新数据核对后再重试。"));
    xhr.onabort = () => reject(new Error("请求已中断，请刷新数据核对导入结果。"));
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}
