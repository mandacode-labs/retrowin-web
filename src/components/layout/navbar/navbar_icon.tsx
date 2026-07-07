import { useCallback } from "react";
import { useLs } from "@/api/generated";
import { useWindowStore } from "@/store/window.store";
import { FileIconType } from "@/types/file";
import { WindowType } from "@/types/window";
import FileIcon from "../../file/file_icon";
import styles from "./navbar_icon.module.css";

export default function NavbarIcon({
  windowType,
  windowCount,
  systemId,
}: {
  windowType: WindowType;
  windowCount: number;
  systemId?: string;
}) {
  // Check if trash has content
  const trashLsQuery = useLs(
    systemId || "",
    { path: "/home/.trash" },
    {
      query: {
        select: (data) =>
          data.status === 200 ? (data.data.entries?.length ?? 0) > 0 : false,
        enabled: !!systemId && windowType === WindowType.Trash,
      },
      fetch: { credentials: "include" },
    }
  );

  // Icon size
  // 5px is the border height and margin
  const size = "calc(100% - 5px)";

  // Store actions
  const highlightWindowsByType = useWindowStore(
    (state) => state.highlightWindowsByType
  );
  const restoreWindow = useWindowStore((state) => state.restoreWindow);
  const windows = useWindowStore((state) => state.windows);
  const newWindow = useWindowStore((state) => state.newWindow);

  const handleClick = useCallback(() => {
    // Restore minimized windows of this type
    windows
      .filter((w) => w.type === windowType && w.minimized)
      .forEach((w) => void restoreWindow(w.key));

    switch (windowType) {
      case WindowType.Uploader:
        if (windowCount === 0) {
          // Open uploader with root path
          newWindow({
            targetKey: "/",
            type: WindowType.Uploader,
            title: "Uploader",
            systemId,
          });
        }
        break;
      case WindowType.Trash:
        if (windowCount === 0) {
          // Open trash with trash path
          newWindow({
            targetKey: "/home/.trash",
            type: WindowType.Trash,
            title: "Trash",
            systemId,
          });
        }
        break;
    }
    // Highlight windows
    highlightWindowsByType(windowType);
  }, [
    highlightWindowsByType,
    newWindow,
    restoreWindow,
    windows,
    windowCount,
    windowType,
    systemId,
  ]);

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.icon_container}
        onClick={handleClick}
      >
        {windowCount > 0 && <div className={styles.icon_highlight} />}
        {windowType === WindowType.Navigator && (
          <FileIcon
            icon={FileIconType.Directory}
            size={size}
            asButton={false}
          />
        )}
        {windowType === WindowType.Image && (
          <FileIcon icon={FileIconType.Image} size={size} asButton={false} />
        )}
        {windowType === WindowType.Video && (
          <FileIcon icon={FileIconType.Video} size={size} asButton={false} />
        )}
        {windowType === WindowType.Audio && (
          <FileIcon icon={FileIconType.Object} size={size} asButton={false} />
        )}
        {windowType === WindowType.Uploader && (
          <FileIcon icon={FileIconType.Upload} size={size} asButton={false} />
        )}
        {windowType === WindowType.Trash && (
          <FileIcon
            icon={FileIconType.Trash}
            size={size}
            asButton={false}
            hasContent={!!trashLsQuery.data}
          />
        )}
        {windowType === WindowType.Document && (
          <FileIcon icon={FileIconType.Regular} size={size} asButton={false} />
        )}
      </button>
    </div>
  );
}
