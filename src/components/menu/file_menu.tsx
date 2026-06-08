import { useCallback } from "react";
import { getDownloadUrl, ls } from "@/api/generated";
import { useDeleteFiles, useMoveFiles } from "@/api/hooks";
import { useFileStore } from "@/store/file.store";
import { useWindowStore } from "@/store/window.store";
import { BackendFileType, type FileType, VirtualFileType } from "@/types/file";
import { WindowType } from "@/types/window";
import { ContentTypes, getContentTypes } from "@/utils/content_type";
import MenuList from "./menu_list";

export default function FileMenu({
  path,
  fileType,
  fileName,
  windowKey,
  parentWindowType,
  closeMenu,
}: {
  path: string;
  fileType: FileType;
  fileName: string;
  windowKey: string;
  parentWindowType: WindowType | null;
  closeMenu: () => void;
}) {
  // Get system ID from window store
  const windows = useWindowStore((state) => state.windows);
  const currentWindow = windows.find((w) => w.key === windowKey);
  const systemId = currentWindow?.systemId || "";

  // Mutations
  const rmMutation = useDeleteFiles();
  const mvMutation = useMoveFiles();

  // Store actions
  const newWindow = useWindowStore((state) => state.newWindow);
  const getSelectedFileKeys = useFileStore(
    (state) => state.getSelectedFileKeys
  );
  const setRenamingFile = useFileStore((state) => state.setRenamingFile);

  // Get all selected file paths (includes the right-clicked file)
  const getTargetPaths = useCallback(() => {
    const selectedKeys = getSelectedFileKeys();
    // Include the right-clicked file even if not in selection
    if (!selectedKeys.includes(path)) {
      return [path];
    }
    return selectedKeys;
  }, [getSelectedFileKeys, path]);

  const openFile = useCallback(
    async (
      fileType: Omit<FileType, BackendFileType.Symlink>,
      fileName: string,
      path: string
    ) => {
      let windowType: WindowType;
      switch (fileType) {
        case BackendFileType.Directory:
        case VirtualFileType.Root:
        case VirtualFileType.Home:
        case VirtualFileType.Trash:
          windowType = WindowType.Navigator;
          break;
        case BackendFileType.Object:
        case BackendFileType.Regular: {
          const contentType = getContentTypes(fileName);
          switch (contentType) {
            case ContentTypes.Image:
              windowType = WindowType.Image;
              break;
            case ContentTypes.Video:
              windowType = WindowType.Video;
              break;
            case ContentTypes.Audio:
              windowType = WindowType.Audio;
              break;
            default:
              windowType = WindowType.Other;
              break;
          }
          break;
        }
        case VirtualFileType.Upload:
          windowType = WindowType.Uploader;
          break;
        default:
          windowType = WindowType.Other;
          break;
      }
      newWindow({
        targetKey: path,
        type: windowType,
        title: fileName,
        systemId,
      });
    },
    [newWindow, systemId]
  );

  // Open file action
  const handleOpen = useCallback(async () => {
    closeMenu();
    openFile(fileType, fileName, path);
  }, [closeMenu, path, fileName, fileType, openFile]);

  // Update file actions
  const handleRename = useCallback(() => {
    closeMenu();
    setRenamingFile({ fileKey: path, windowKey });
  }, [closeMenu, path, windowKey, setRenamingFile]);

  // Download file actions
  const handleDownload = useCallback(async () => {
    closeMenu();
    try {
      const result = await getDownloadUrl(
        systemId,
        { path },
        { credentials: "include" }
      );
      if (result.status !== 200 || !result.data.downloadUrl?.downloadUrl) {
        console.error("[FileMenu] Failed to get download URL");
        return;
      }
      const { downloadUrl } = result.data.downloadUrl;
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        console.error("[FileMenu] Download fetch failed:", response.status);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[FileMenu] Download failed:", error);
    }
  }, [closeMenu, systemId, path, fileName]);

  // Move to trash action
  const handleMoveToTrash = useCallback(async () => {
    closeMenu();
    try {
      const paths = getTargetPaths();
      await mvMutation.mutateAsync({
        systemId,
        data: { sources: paths, destination: "/home/.trash" },
      });
    } catch (error) {
      console.error("[FileMenu] Move to trash failed:", error);
    }
  }, [closeMenu, getTargetPaths, systemId, mvMutation]);

  const handlePermanentDelete = useCallback(async () => {
    closeMenu();
    try {
      const paths = getTargetPaths();
      await rmMutation.mutateAsync({
        systemId,
        data: { paths, recursive: true },
      });
    } catch (error) {
      console.error("[FileMenu] Permanent delete failed:", error);
    }
  }, [closeMenu, getTargetPaths, systemId, rmMutation]);

  const handleEmptyTrash = useCallback(async () => {
    closeMenu();
    try {
      const readDirResult = await ls(
        systemId,
        { path },
        { credentials: "include" }
      );
      if (readDirResult.data && "entries" in readDirResult.data) {
        const paths = readDirResult.data.entries.map(
          (entry) => `${path === "/" ? "" : path}/${entry.name}`
        );
        await rmMutation.mutateAsync({
          systemId,
          data: { paths, recursive: true },
        });
      }
    } catch (error) {
      console.error("[FileMenu] Empty trash failed:", error);
    }
  }, [closeMenu, path, systemId, rmMutation]);

  // Info action
  const handleInfo = useCallback(() => {
    closeMenu();
    newWindow({
      targetKey: path,
      type: WindowType.Info,
      title: `${fileName} Info`,
      systemId,
    });
  }, [closeMenu, newWindow, path, fileName, systemId]);

  // Delete file actions based on parent window type
  const deleteMenu =
    parentWindowType === WindowType.Trash
      ? { name: "Permanent Delete", action: handlePermanentDelete }
      : { name: "Move to Trash", action: handleMoveToTrash };

  const infoItem = { name: "Info", action: handleInfo };

  switch (fileType) {
    case BackendFileType.Directory:
    case VirtualFileType.Root:
    case VirtualFileType.Home:
      return (
        <MenuList
          menuList={[
            { name: "Open", action: handleOpen },
            infoItem,
            { name: "Rename", action: handleRename },
            { name: "/", action: () => {} },
            deleteMenu,
          ]}
        />
      );
    case BackendFileType.Object:
      return (
        <MenuList
          menuList={[
            { name: "Open", action: handleOpen },
            { name: "Download", action: handleDownload },
            infoItem,
            { name: "Rename", action: handleRename },
            { name: "/", action: () => {} },
            deleteMenu,
          ]}
        />
      );
    case BackendFileType.Regular:
      return (
        <MenuList
          menuList={[
            infoItem,
            { name: "Rename", action: handleRename },
            { name: "/", action: () => {} },
            deleteMenu,
          ]}
        />
      );
    case BackendFileType.Symlink:
      return (
        <MenuList
          menuList={[
            { name: "Open", action: handleOpen },
            infoItem,
            { name: "Rename", action: handleRename },
            { name: "/", action: () => {} },
            deleteMenu,
          ]}
        />
      );
    case VirtualFileType.Upload:
      return <MenuList menuList={[{ name: "Open", action: handleOpen }]} />;
    case VirtualFileType.Trash:
      return (
        <MenuList
          menuList={[{ name: "Empty Trash", action: handleEmptyTrash }]}
        />
      );
    default:
      return null;
  }
}
