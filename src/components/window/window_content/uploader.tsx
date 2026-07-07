"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useUploadManager } from "@/api/hooks/use-upload";
import { isFsQuery } from "@/utils/query_keys";
import { XPImageIcons } from "@/components/icons/xp_image_icons";
import { useWindowStore } from "@/store/window.store";
import styles from "./uploader.module.css";

interface UploaderProps {
  targetPath: string;
}

export default function Uploader({ targetPath }: UploaderProps) {
  const windows = useWindowStore((state) => state.windows);
  const currentWindow = windows.find((w) => w.targetKey === targetPath);
  const systemId = currentWindow?.systemId || "";

  const queryClient = useQueryClient();

  const {
    tasks,
    addFiles,
    startUpload,
    cancelUpload,
    retryUpload,
    removeTask,
    clearCompleted,
  } = useUploadManager(systemId, targetPath);

  const handleStartUpload = useCallback(async () => {
    await startUpload();
    queryClient.invalidateQueries({ predicate: isFsQuery });
  }, [startUpload, queryClient]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClickDropZone = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending...";
      case "uploading":
        return "Uploading...";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "cancelled":
        return "Cancelled";
      case "skipped":
        return "Already exists";
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "completed":
        return styles.statusCompleted;
      case "failed":
        return styles.statusFailed;
      case "skipped":
        return styles.statusSkipped;
      case "uploading":
        return styles.statusUploading;
      default:
        return "";
    }
  };

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const failedCount = tasks.filter(
    (t) => t.status === "failed" || t.status === "skipped"
  ).length;

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ""}`}
        onClick={handleClickDropZone}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        Drag and drop files here or click to select
      </button>

      <input
        ref={fileInputRef}
        type="file"
        className={styles.fileInput}
        multiple
        onChange={handleFileSelect}
      />

      <div className={styles.fileList}>
        {tasks.length === 0 ? (
          <div style={{ textAlign: "center", color: "#999", padding: "20px" }}>
            No files to upload
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className={styles.task}>
              <XPImageIcons.File size={16} />

              <span className={styles.fileName} title={task.fileName}>
                {task.fileName}
              </span>

              {task.status === "uploading" && (
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressBarFill}
                    style={{ width: `${task.progress}%` }}
                  />
                  <span className={styles.progressText}>
                    {Math.round(task.progress)}%
                  </span>
                </div>
              )}

              <span
                className={`${styles.status} ${getStatusClass(task.status)}`}
              >
                {getStatusText(task.status)}
              </span>

              {task.status === "uploading" && (
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => cancelUpload(task.id)}
                >
                  Cancel
                </button>
              )}

              {task.status === "failed" && (
                <>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => retryUpload(task.id)}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => removeTask(task.id)}
                  >
                    Remove
                  </button>
                </>
              )}

              {(task.status === "completed" ||
                task.status === "skipped" ||
                task.status === "cancelled") && (
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => removeTask(task.id)}
                >
                  Remove
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {tasks.length > 0 && (
        <div className={styles.footer}>
          <span style={{ fontSize: 11, color: "#666" }}>
            Completed: {completedCount} / {tasks.length}
            {failedCount > 0 && ` (Failed: ${failedCount})`}
          </span>

          <div className={styles.footerActions}>
            {pendingCount > 0 && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleStartUpload}
                disabled={!systemId}
              >
                Upload {pendingCount}
              </button>
            )}

            {completedCount > 0 && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={clearCompleted}
              >
                Clear Completed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
