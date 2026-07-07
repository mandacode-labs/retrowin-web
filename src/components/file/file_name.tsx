import { memo, useEffect, useRef, useState } from "react";
import { useRenameFile } from "@/api/hooks";
import { useFileStore } from "@/store/file.store";
import { useWindowStore } from "@/store/window.store";
import { parseSerialKey } from "@/utils/serial_key";
import styles from "./file_name.module.css";

/**
 * File name component
 * @param name - name of the file
 * @param fileKey - key of the file (path in new API)
 * @param windowKey - key of the window
 * @param backgroundFile - is background file
 * @returns - File name component
 */
export default memo(function FileName({
  name,
  fileKey,
  windowKey,
  backgroundFile = false,
  isSelected = false,
}: {
  name: string;
  fileKey: string;
  windowKey: string;
  backgroundFile?: boolean;
  isSelected?: boolean;
}) {
  // States
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(name);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);

  // Store state
  const renamingFileSerial = useFileStore((state) => state.renamingFileSerial);
  // Store actions
  const setRenamingFile = useFileStore((state) => state.setRenamingFile);

  // Get system ID from window store
  const windows = useWindowStore((state) => state.windows);
  const currentWindow = windows.find((w) => w.key === windowKey);
  const systemId = currentWindow?.systemId || "";

  // Mutations
  const renameMutation = useRenameFile();

  // Update file name via API
  const updateFileName = async () => {
    if (!newName.trim() || newName === name) {
      setIsRenaming(false);
      setRenamingFile(null);
      return;
    }

    try {
      await renameMutation.mutateAsync({
        systemId,
        data: {
          path: fileKey,
          newName: newName.trim(),
        },
      });
    } catch (error) {
      console.error("[FileName] Rename failed:", error);
      // Reset to original name on error
      setNewName(name);
    }

    setIsRenaming(false);
    setRenamingFile(null);
  };

  // Set isRenaming state when the file is the renaming file
  useEffect(() => {
    if (renamingFileSerial) {
      const { fileKey: renamingFileKey, windowKey: renamingWindowKey } =
        parseSerialKey(renamingFileSerial);
      if (fileKey === renamingFileKey && windowKey === renamingWindowKey) {
        setIsRenaming(true);
      }
    } else {
      setIsRenaming(false);
    }
  }, [fileKey, renamingFileSerial, windowKey]);

  // Focus and select all text when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  return (
    <div className={`flex-center full-size`}>
      {isRenaming ? (
        <form
          className={styles.rename_form}
          onSubmit={(e) => {
            e.preventDefault();
            updateFileName();
            setIsRenaming(false);
            setRenamingFile(null);
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className={`${styles.rename_input} ${backgroundFile ? styles.rename_input_background : ""}`}
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
            }}
            onBlur={() => {
              setIsRenaming(false);
              setRenamingFile(null);
            }}
          />
        </form>
      ) : (
        <div className={styles.stale_container}>
          <div
            className={`${styles.name_text} ${backgroundFile ? styles.background_file_name : ""} ${isSelected ? styles.name_text_expanded : ""}`}
          >
            {name}
          </div>
        </div>
      )}
    </div>
  );
});
