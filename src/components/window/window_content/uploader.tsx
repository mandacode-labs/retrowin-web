"use client";

import { useCallback, useRef, useState } from "react";
import { useUploadManager } from "@/api/hooks/use-upload";
import { useWindowStore } from "@/store/window.store";
import { XPImageIcons } from "@/components/icons/xp_image_icons";
import styles from "./uploader.module.css";

interface UploaderProps {
  targetPath: string;
}

export default function Uploader({ targetPath }: UploaderProps) {
  const windows = useWindowStore((state) => state.windows);
  const currentWindow = windows.find((w) => w.targetKey === targetPath);
  const systemId = currentWindow?.systemId || "";

  const {
    tasks,
    isUploading,
    addFiles,
    cancelUpload,
    retryUpload,
    removeTask,
    clearCompleted,
  } = useUploadManager(systemId);

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
        return "대기 중...";
      case "uploading":
        return "업로드 중...";
      case "completed":
        return "완료";
      case "failed":
        return "실패";
      case "cancelled":
        return "취소됨";
      case "skipped":
        return "이미 존재";
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
  const failedCount = tasks.filter(
    (t) => t.status === "failed" || t.status === "skipped"
  ).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>파일 업로드</span>
      </div>

      <div
        className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ""}`}
        onClick={handleClickDropZone}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        파일을 여기로 끌어다 놓거나 클릭하여 선택하세요
      </div>

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
            업로드할 파일이 없습니다
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className={styles.task}>
              <div style={{ width: 24, height: 24, flexShrink: 0 }}>
                <XPImageIcons.File />
              </div>

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

              <span className={`${styles.status} ${getStatusClass(task.status)}`}>
                {getStatusText(task.status)}
              </span>

              {task.status === "uploading" && (
                <button
                  className={styles.actionButton}
                  onClick={() => cancelUpload(task.id)}
                >
                  취소
                </button>
              )}

              {task.status === "failed" && (
                <>
                  <button
                    className={styles.actionButton}
                    onClick={() => retryUpload(task.id)}
                  >
                    재시도
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => removeTask(task.id)}
                  >
                    제거
                  </button>
                </>
              )}

              {(task.status === "completed" ||
                task.status === "skipped" ||
                task.status === "cancelled") && (
                <button
                  className={styles.actionButton}
                  onClick={() => removeTask(task.id)}
                >
                  제거
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {tasks.length > 0 && (
        <div className={styles.footer}>
          <span style={{ fontSize: 11, color: "#666" }}>
            완료: {completedCount} / {tasks.length}
            {failedCount > 0 && ` (실패: ${failedCount})`}
          </span>

          {completedCount > 0 && (
            <button className={styles.actionButton} onClick={clearCompleted}>
              완료 항목 제거
            </button>
          )}
        </div>
      )}
    </div>
  );
}
