import { useCallback, useEffect } from "react";
import type { DirEntry } from "@/api/generated/model";
import { useDirectory, useFileInfo } from "@/api/hooks";
import { SpecialFileName, VirtualFileType } from "@/types/file";
import { getFileType, getFileTypeSortOrder } from "@/utils/file_type";
import styles from "./file_container.module.css";
import FileItem from "./file_item";

/**
 * Check if path is trash directory
 */
const _isTrashPath = (path: string): boolean => {
  return path === "/.trash" || path.endsWith("/.trash");
};

/**
 * Check if path is upload directory
 */
const _isUploadPath = (path: string): boolean => {
  return path === "/.upload" || path.endsWith("/.upload");
};

/**
 * File container component
 * @param windowKey - key of the window
 * @param systemId - system ID
 * @param path - current directory path
 * @param setLoading - set loading state
 * @param upload - show upload file
 * @param trash - show trash file
 * @param backgroundFile - is background file
 * @returns - File container component
 * @example
 * <FileContainer windowKey="421b0ad1f948" systemId="sys-123" path="/home/user" />
 */
export default function FileContainer({
  windowKey,
  systemId,
  path,
  setLoading,
  upload = false,
  trash = false,
  backgroundFile = false,
}: {
  windowKey: string;
  systemId: string;
  path: string;
  setLoading?: React.Dispatch<React.SetStateAction<boolean>>;
  upload?: boolean;
  trash?: boolean;
  backgroundFile?: boolean;
}) {
  // Use custom hooks
  const readDirQuery = useDirectory(systemId, path);

  // Get trash inode if trash should be shown (trash is under home)
  const trashPath = "/home/.trash";
  const trashStatQuery = useFileInfo(systemId, trashPath);

  const sortFiles = useCallback((a: DirEntry, b: DirEntry): number => {
    // Home > Trash > Upload > Others
    const specialFileOrder = [
      SpecialFileName.Root,
      SpecialFileName.Home,
      SpecialFileName.Trash,
      SpecialFileName.Upload,
    ] as string[];

    // Skip hidden files starting with dot
    if (a.name.startsWith(".")) return 1;
    if (b.name.startsWith(".")) return -1;

    const aIndex = specialFileOrder.indexOf(a.name);
    const bIndex = specialFileOrder.indexOf(b.name);
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) {
      return -1;
    }
    if (bIndex !== -1) {
      return 1;
    }
    // Container > Object > Regular > Link
    const aTypeOrder = getFileTypeSortOrder(getFileType(a.fileType));
    const bTypeOrder = getFileTypeSortOrder(getFileType(b.fileType));
    return aTypeOrder - bTypeOrder;
  }, []);

  useEffect(() => {
    if (setLoading) {
      // Set loading state
      setLoading(readDirQuery.isFetching);
    }
  }, [readDirQuery.isFetching, setLoading]);

  if (readDirQuery.isError && readDirQuery.error) {
    return (
      <div className="flex-center full-size">
        {"message" in readDirQuery.error &&
        typeof readDirQuery.error.message === "string"
          ? readDirQuery.error.message
          : "Error loading files"}
      </div>
    );
  }

  return (
    <div className={`${styles.container} full-size`}>
      {upload && (
        <FileItem
          name={SpecialFileName.Upload}
          type={VirtualFileType.Upload}
          fileKey={path}
          windowKey={windowKey}
          systemId={systemId}
          backgroundFile={backgroundFile}
        />
      )}
      {trash && trashStatQuery.isSuccess && trashStatQuery.data && (
        <FileItem
          name={SpecialFileName.Trash}
          type={VirtualFileType.Trash}
          fileKey={trashPath}
          windowKey={windowKey}
          systemId={systemId}
          backgroundFile={backgroundFile}
        />
      )}
      {readDirQuery.data
        ?.filter((entry: DirEntry) => !entry.name.startsWith("."))
        .sort(sortFiles)
        .map((file: DirEntry) => (
          <FileItem
            key={file.inodeId}
            name={file.name}
            type={getFileType(file.fileType)}
            fileKey={`${path === "/" ? "" : path}/${file.name}`}
            windowKey={windowKey}
            systemId={systemId}
            backgroundFile={backgroundFile}
          />
        ))}
    </div>
  );
}
