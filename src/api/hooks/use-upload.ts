import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  getCompleteUploadMutationOptions,
  getInitiateUploadMutationOptions,
  statPath,
} from "@/api/generated";
import { parseApiError } from "@/api/utils";
import { md5Base64 } from "@/utils/md5";

export type UploadStatus =
  | "pending"
  | "uploading"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped";

export interface UploadTask {
  id: string;
  file: File;
  fileName: string;
  status: UploadStatus;
  progress: number;
  bytesUploaded: number;
  totalBytes: number;
  error?: string;
  retryCount: number;
}

interface UploadManagerState {
  tasks: UploadTask[];
  isUploading: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];
const CONCURRENCY = 5;

export function useUploadManager(systemId: string, targetPath: string) {
  const [state, setState] = useState<UploadManagerState>({
    tasks: [],
    isUploading: false,
  });

  const resolveFilePath = useCallback(
    (fileName: string) => {
      const trimmed = targetPath.replace(/\/+$/, "");
      if (!trimmed || trimmed === "") return `/${fileName}`;
      return `${trimmed}/${fileName}`;
    },
    [targetPath]
  );

  // Use ref to always access latest state without stale closure issues
  const tasksRef = useRef<UploadTask[]>([]);
  tasksRef.current = state.tasks;

  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const activeUploadsRef = useRef<number>(0);
  const isCancelledRef = useRef<Set<string>>(new Set());

  const initiateUpload = useMutation({
    ...getInitiateUploadMutationOptions(),
  });

  const completeUpload = useMutation({
    ...getCompleteUploadMutationOptions(),
  });

  const checkDuplicate = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        const result = await statPath(systemId, { path });
        return result.status === 200;
      } catch {
        return false;
      }
    },
    [systemId]
  );

  const uploadFile = useCallback(
    async (taskId: string) => {
      // Get task from ref to avoid stale closure
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (
        !task ||
        task.status === "cancelled" ||
        isCancelledRef.current.has(taskId)
      ) {
        return;
      }

      const abortController = new AbortController();
      abortControllersRef.current.set(taskId, abortController);
      activeUploadsRef.current++;

      setState((prev) => ({
        ...prev,
        isUploading: true,
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? { ...t, status: "uploading", error: undefined, progress: 0 }
            : t
        ),
      }));

      try {
        const filePath = resolveFilePath(task.fileName);

        // Check for duplicate
        const exists = await checkDuplicate(filePath);
        if (exists) {
          setState((prev) => ({
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId
                ? { ...t, status: "skipped", error: "File already exists" }
                : t
            ),
          }));
          return;
        }

        // Compute checksum
        const fileBuffer = await task.file.arrayBuffer();
        const checksum = await md5Base64(fileBuffer);
        const idempotencyKey = crypto.randomUUID();

        // Step 1: Initiate upload
        const initiateResult = await initiateUpload.mutateAsync({
          systemId,
          data: {
            path: filePath,
            contentType: task.file.type,
            size: task.totalBytes,
            checksum,
            idempotencyKey,
          },
        });

        if (
          initiateResult.status !== 201 ||
          !initiateResult.data.uploadSession
        ) {
          throw new Error("Failed to initiate upload");
        }

        const { objectId, uploadUrl } = initiateResult.data.uploadSession;

        // Step 2: Upload to S3 with progress tracking
        await uploadToS3(
          uploadUrl,
          task.file,
          abortController.signal,
          (progress) => {
            // Check if cancelled during upload
            if (isCancelledRef.current.has(taskId)) {
              abortController.abort();
              return;
            }
            setState((prev) => ({
              ...prev,
              tasks: prev.tasks.map((t) =>
                t.id === taskId ? { ...t, progress } : t
              ),
            }));
          }
        );

        // Check if cancelled after S3 upload
        if (isCancelledRef.current.has(taskId)) {
          return;
        }

        // Step 3: Complete upload
        await completeUpload.mutateAsync({
          systemId,
          data: {
            objectId,
            path: filePath,
          },
        });

        // Success
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, status: "completed", progress: 100 } : t
          ),
        }));
      } catch (error) {
        if (
          abortController.signal.aborted ||
          isCancelledRef.current.has(taskId)
        ) {
          return;
        }

        const errorMessage = parseApiError(error).message;

        // Get current retry count from ref
        const currentTask = tasksRef.current.find((t) => t.id === taskId);
        const retryCount = currentTask?.retryCount ?? 0;

        // Auto-retry if not maxed out
        if (retryCount < MAX_RETRIES) {
          const delay =
            RETRY_DELAYS[retryCount] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Check if cancelled during retry delay
          if (isCancelledRef.current.has(taskId)) {
            return;
          }

          setState((prev) => ({
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId
                ? { ...t, retryCount: t.retryCount + 1, status: "pending" }
                : t
            ),
          }));

          // Retry
          await uploadFile(taskId);
          return;
        }

        // Max retries reached
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: "failed", error: errorMessage }
              : t
          ),
        }));
      } finally {
        abortControllersRef.current.delete(taskId);
        activeUploadsRef.current--;
        isCancelledRef.current.delete(taskId);

        setState((prev) => ({
          ...prev,
          isUploading: prev.tasks.some((t) => t.status === "uploading"),
        }));
      }
    },
    [systemId, initiateUpload, completeUpload, checkDuplicate, resolveFilePath]
  );

  const addFiles = useCallback((files: FileList | File[]) => {
    const newTasks: UploadTask[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      status: "pending",
      progress: 0,
      bytesUploaded: 0,
      totalBytes: file.size,
      retryCount: 0,
    }));

    setState((prev) => ({
      ...prev,
      tasks: [...prev.tasks, ...newTasks],
    }));
  }, []);

  const startUpload = useCallback(async () => {
    const pending = tasksRef.current.filter((t) => t.status === "pending");
    if (pending.length === 0) return;

    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map((task) => uploadFile(task.id)));
    }
  }, [uploadFile]);

  const cancelUpload = useCallback((taskId: string) => {
    isCancelledRef.current.add(taskId);

    const abortController = abortControllersRef.current.get(taskId);
    if (abortController) {
      abortController.abort();
      abortControllersRef.current.delete(taskId);
    }

    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId ? { ...t, status: "cancelled" } : t
      ),
    }));
  }, []);

  const retryUpload = useCallback(
    (taskId: string) => {
      isCancelledRef.current.delete(taskId);

      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "pending",
                error: undefined,
                retryCount: 0,
                progress: 0,
              }
            : t
        ),
      }));

      // Use setTimeout to allow state update to complete
      setTimeout(() => uploadFile(taskId), 0);
    },
    [uploadFile]
  );

  const removeTask = useCallback(
    (taskId: string) => {
      cancelUpload(taskId);
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
      }));
    },
    [cancelUpload]
  );

  const clearCompleted = useCallback(() => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter(
        (t) => t.status !== "completed" && t.status !== "cancelled"
      ),
    }));
  }, []);

  return {
    tasks: state.tasks,
    isUploading: state.isUploading,
    addFiles,
    startUpload,
    cancelUpload,
    retryUpload,
    removeTask,
    clearCompleted,
  };
}

function uploadToS3(
  url: string,
  file: File,
  signal: AbortSignal,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    signal.addEventListener("abort", () => {
      xhr.abort();
    });

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}
