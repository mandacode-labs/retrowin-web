import { useFileInfo } from "@/api/hooks";
import { useWindowStore } from "@/store/window.store";
import styles from "./info.module.css";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString();
}

export default function InfoViewer({
  fileKey: path,
  fileName,
}: {
  fileKey: string;
  fileName: string;
}) {
  const windows = useWindowStore((state) => state.windows);
  const currentWindow = windows.find((w) => w.targetKey === path);
  const systemId = currentWindow?.systemId || "";

  const statQuery = useFileInfo(systemId, path);

  const inode = statQuery.data ?? null;

  if (statQuery.isLoading) {
    return (
      <div className={`full-size flex-center ${styles.container}`}>
        <span className={styles.loading}>Loading...</span>
      </div>
    );
  }

  if (!inode) {
    return (
      <div className={`full-size flex-center ${styles.container}`}>
        <span className={styles.error}>File info not available</span>
      </div>
    );
  }

  return (
    <div className={`full-size ${styles.container}`}>
      <table className={styles.table}>
        <tbody>
          <tr>
            <td className={styles.label}>name</td>
            <td className={styles.value}>{fileName}</td>
          </tr>
          <tr>
            <td className={styles.label}>size</td>
            <td className={styles.value}>{formatBytes(inode.size || 0)}</td>
          </tr>
          <tr>
            <td className={styles.label}>type</td>
            <td className={styles.value}>
              {(inode.mode ?? 0) & 0o040000 ? "directory" : "file"}
            </td>
          </tr>
          <tr>
            <td className={styles.label}>mode</td>
            <td className={styles.value}>
              {(inode.mode ?? 0).toString(8).padStart(4, "0")}
            </td>
          </tr>
          <tr>
            <td className={styles.label}>uid</td>
            <td className={styles.value}>{inode.uid}</td>
          </tr>
          <tr>
            <td className={styles.label}>gid</td>
            <td className={styles.value}>{inode.gid}</td>
          </tr>
          <tr>
            <td className={styles.label}>created</td>
            <td className={styles.value}>{formatDate(inode.createdAt)}</td>
          </tr>
          <tr>
            <td className={styles.label}>modified</td>
            <td className={styles.value}>{formatDate(inode.mtime)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
