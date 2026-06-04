import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useCreateDirectory } from "@/api/hooks";
import { useWindowStore } from "@/store/window.store";
import { WindowType } from "@/types/window";
import { isFsQuery } from "@/utils/query_keys";
import MenuList from "./menu_list";

export default function BackgroundMenu({
  path,
  closeMenu,
}: {
  path: string;
  closeMenu: () => void;
}) {
  // Query client
  const queryClient = useQueryClient();

  // Get system ID from window store
  const windows = useWindowStore((state) => state.windows);
  const backgroundWindow = windows.find(
    (w) => w.type === WindowType.Background
  );
  const systemId = backgroundWindow?.systemId || "";

  // Mutations
  const mkdirMutation = useCreateDirectory();

  // Store actions
  const newWindow = useWindowStore((state) => state.newWindow);

  const handleUpload = useCallback(() => {
    if (path) {
      newWindow({
        targetKey: path,
        type: WindowType.Uploader,
        title: "Uploader",
        systemId,
      });
      closeMenu();
    }
  }, [path, systemId, newWindow, closeMenu]);

  const handleCreateFolder = useCallback(async () => {
    if (!path || !systemId) {
      console.error(
        "[BackgroundMenu] Cannot create folder: missing path or systemId",
        { path, systemId }
      );
      return;
    }
    closeMenu();

    // Find a unique folder name
    const folderName = "New Folder";
    const _counter = 1;
    // Note: In production, you'd want to check existing folders first

    const folderPath = `${path === "/" ? "" : path}/${folderName}`;
    console.log("[BackgroundMenu] Creating folder:", {
      systemId,
      path: folderPath,
    });

    try {
      await mkdirMutation.mutateAsync({
        systemId,
        data: {
          path: folderPath,
          mode: 0o755,
        },
      });
      queryClient.invalidateQueries({
        predicate: isFsQuery,
      });
    } catch (error) {
      console.error("[BackgroundMenu] Failed to create folder:", error);
    }
  }, [path, systemId, closeMenu, mkdirMutation, queryClient]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: isFsQuery,
    });
    closeMenu();
  }, [queryClient, closeMenu]);

  const menuList = [
    { name: "Upload", action: handleUpload },
    { name: "Create Folder", action: handleCreateFolder },
    { name: "/", action: () => {} },
    { name: "Refresh", action: handleRefresh },
  ];

  return <MenuList menuList={menuList} />;
}
