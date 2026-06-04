import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useCompleteUpload, useInitiateUpload } from "@/api/generated";
import { useWindowStore } from "@/store/window.store";
import { md5Base64 } from "@/utils/md5";
import { isFsQuery } from "@/utils/query_keys";
import styles from "./uploader.module.css";

export default function Uploader({ targetPath }: { targetPath: string }) {
  // Query Client
  const queryClient = useQueryClient();

  // Get system ID from window store
  const windows = useWindowStore((state) => state.windows);
  const currentWindow = windows.find((w) => w.targetKey === targetPath);

  // Get system ID from window state or use default
  const systemId = currentWindow?.systemId || "";

  // Mutations
  const initiateUploadMutation = useInitiateUpload();
  const completeUploadMutation = useCompleteUpload();

  // State
  const [uploadState, setUploadState] = useState<
    {
      objectId: string;
      fileName: string;
      totalSize: number;
      uploadedSize: number;
    }[]
  >([]);

  // Upload state actions
  const addUpload = useCallback(
    (upload: {
      objectId: string;
      fileName: string;
      totalSize: number;
      uploadedSize: number;
    }) => {
      setUploadState((state) => [...state, upload]);
    },
    []
  );

  const updateUpload = useCallback((objectId: string, uploadedSize: number) => {
    setUploadState((state) =>
      state.map((upload) =>
        upload.objectId === objectId ? { ...upload, uploadedSize } : upload
      )
    );
  }, []);

  const removeUpload = useCallback((objectId: string) => {
    setUploadState((state) =>
      state.filter((upload) => upload.objectId !== objectId)
    );
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      let objectId: string | null = null;

      try {
        // Compute MD5 checksum and generate idempotency key
        const fileBuffer = await file.arrayBuffer();
        const checksum = await md5Base64(fileBuffer);
        const idempotencyKey = crypto.randomUUID();

        // Step 1: Initiate upload to get presigned URL
        const initiateResult = await initiateUploadMutation.mutateAsync({
          systemId,
          data: {
            path: `${targetPath === "/" ? "" : targetPath}/${file.name}`,
            contentType: file.type,
            size: file.size,
            checksum,
            idempotencyKey,
          },
        });

        if (initiateResult.data && "uploadSession" in initiateResult.data) {
          objectId = initiateResult.data.uploadSession.objectId;
        }

        if (!objectId) {
          throw new Error("Failed to initiate upload");
        }

        // Add to upload state
        addUpload({
          objectId,
          fileName: file.name,
          totalSize: file.size,
          uploadedSize: 0,
        });

        // Step 2: Get presigned URL from response
        let uploadUrl: string | null = null;
        if (initiateResult.data && "uploadSession" in initiateResult.data) {
          uploadUrl = initiateResult.data.uploadSession.uploadUrl;
        }

        if (!uploadUrl) {
          throw new Error("Failed to get upload URL");
        }

        // Step 3: Upload file directly to S3 using presigned URL
        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        // Update upload state to 100%
        updateUpload(objectId, file.size);

        // Step 4: Complete upload to create inode
        await completeUploadMutation.mutateAsync({
          systemId,
          data: {
            objectId,
            path: `${targetPath === "/" ? "" : targetPath}/${file.name}`,
          },
        });

        // Invalidate queries to refresh file list
        queryClient.invalidateQueries({
          predicate: isFsQuery,
        });
      } finally {
        // Remove from upload state
        if (objectId) {
          removeUpload(objectId);
        }
      }
    },
    [
      systemId,
      targetPath,
      initiateUploadMutation,
      completeUploadMutation,
      addUpload,
      updateUpload,
      removeUpload,
      queryClient,
    ]
  );

  const uploadFiles = useCallback(
    async (files: FileList) => {
      // Sort files by size (small to large)
      const sortedFiles = Array.from(files).sort((a, b) => a.size - b.size);

      // Upload files in parallel with concurrency limit
      const concurrency = Number(
        process.env.NEXT_PUBLIC_UPLOAD_CONCURRENCY || 10
      );
      for (let i = 0; i < sortedFiles.length; i += concurrency) {
        const batch = sortedFiles.slice(i, i + concurrency);
        await Promise.allSettled(batch.map((file) => uploadFile(file)));
      }
    },
    [uploadFile]
  );

  const handleUpload = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const files = (e.target as HTMLFormElement).querySelector("input")?.files;

      if (files && files.length > 0) {
        uploadFiles(files);
      }
    },
    [uploadFiles]
  );

  return (
    <div className={`${styles.container} full-size`}>
      <div className={`full-size`}>
        <div className={`${styles.upload_state} full-size`}>
          {uploadState.map((upload) => (
            <div key={upload.objectId} className={styles.progress_container}>
              <span>{upload.fileName}</span>
              <progress
                value={upload.uploadedSize}
                max={upload.totalSize}
              ></progress>
              <div>
                {Math.round((upload.uploadedSize / upload.totalSize) * 100)}%
              </div>
            </div>
          ))}
        </div>
      </div>
      <form className={styles.form} onSubmit={handleUpload}>
        <input type="file" className={styles.input} multiple />
        <button type="submit" className={styles.button}>
          Upload
        </button>
      </form>
    </div>
  );
}
