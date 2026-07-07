"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLs } from "@/api/generated";
import { useFileStore } from "@/store/file.store";
import { useEventStore } from "@/store/ui.store";
import { useWindowStore } from "@/store/window.store";
import type { FileType } from "@/types/file";
import { type FileIconType, VirtualFileType } from "@/types/file";
import { WindowType } from "@/types/window";
import { getIconType, getWindowType, isSelectable } from "@/utils/file_type";
import { createSerialKey } from "@/utils/serial_key";
import FileIcon from "./file_icon";
import styles from "./file_item.module.css";
import FileName from "./file_name";

/**
 * File item component
 * @param name - name of the file
 * @param type - type of the file
 * @param fileKey - key of the file
 * @param windowKey - key of the window
 * @param backgroundFile - Is background file
 * @returns - File item component
 * @example
 * <FileItem name="file" type={BackendFileType.Directory} fileKey="e03431b7-6d67-4ee2-9224-e93dc04f25c4" windowKey="421b0ad1f948" />
 */
export default memo(function FileItem({
  name,
  type,
  fileKey,
  windowKey,
  systemId,
  backgroundFile = false,
}: {
  name: string;
  type: FileType;
  fileKey: string;
  windowKey: string;
  systemId?: string;
  backgroundFile?: boolean;
}) {
  // constants
  const serialKey = createSerialKey(fileKey, windowKey);
  const selectedFileBackground = "#f0f0f033";
  const selectedFile = "#55555533";

  // States
  const [icon, setIcon] = useState<FileIconType | null>(null);

  // Store state
  const selectedFileSerials = useFileStore(
    (state) => state.selectedFileSerials
  );
  const selectBox = useFileStore((state) => state.selectBoxRect);
  const targetWindow = useFileStore((state) => state.selectBoxWindowKey);
  const pressedKeys = useEventStore((state) => state.pressedKeys);
  // Store actions
  const setFileIconRef = useFileStore((state) => state.setFileIconRef);
  const setHighlightedFile = useFileStore((state) => state.setHighlightedFile);
  const selectFile = useFileStore((state) => state.selectFile);
  const unselectFile = useFileStore((state) => state.unselectFile);
  const unselectAllFiles = useFileStore((state) => state.unselectAllFiles);
  const newWindow = useWindowStore((state) => state.newWindow);
  const getBackgroundWindow = useWindowStore(
    (state) => state.getBackgroundWindow
  );
  const updateWindow = useWindowStore((state) => state.updateWindow);

  // Refs
  const fileRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);

  // Check if trash has content
  const trashLsQuery = useLs(
    systemId || "",
    { path: fileKey },
    {
      query: {
        select: (data) =>
          data.status === 200 ? (data.data.entries?.length ?? 0) > 0 : false,
        enabled: !!systemId && type === VirtualFileType.Trash,
      },
      fetch: { credentials: "include" },
    }
  );

  // Get background window key
  const backgroundWindowKey = useMemo(() => {
    const backgroundWindow = getBackgroundWindow();
    return backgroundWindow?.key || "";
  }, [getBackgroundWindow]);

  const handleMouseEnter = useCallback(() => {
    setHighlightedFile({
      fileKey,
      windowKey,
      fileName: name,
      type,
      ref: fileRef,
    });
  }, [setHighlightedFile, fileKey, windowKey, name, type]);

  const handleMouseLeave = useCallback(() => {
    setHighlightedFile(null);
  }, [setHighlightedFile]);

  // Check if the file is in the select box
  const checkFileInSelectBox = useCallback(() => {
    if (!selectBox) return;
    if (!fileRef.current) return;
    if (windowKey !== targetWindow) return;
    const fileRect = fileRef.current.getBoundingClientRect();
    if (
      isSelectable(type) &&
      fileRect.top < selectBox.bottom &&
      fileRect.bottom > selectBox.top &&
      fileRect.left < selectBox.right &&
      fileRect.right > selectBox.left
    ) {
      selectFile(fileKey, windowKey);
    } else {
      unselectFile(fileKey, windowKey);
    }
  }, [
    fileKey,
    selectBox,
    selectFile,
    targetWindow,
    type,
    unselectFile,
    windowKey,
  ]);

  // Check if the file is in the select box
  useEffect(() => {
    checkFileInSelectBox();
  }, [checkFileInSelectBox]);

  // Set icon type
  useEffect(() => {
    setIcon(getIconType(type, name));
  }, [type, name]);

  // Assign fileRef to store
  useEffect(() => {
    setFileIconRef(fileKey, windowKey, iconRef);
  }, [fileKey, setFileIconRef, windowKey]);

  // Single click: select file. Clear previous selection unless Shift is held
  // or the file is already selected. Mirrors drag_file_container.tsx behavior.
  const handleSingleClick = useCallback(() => {
    const isAlreadySelected = selectedFileSerials.includes(serialKey);
    if (!isAlreadySelected && !pressedKeys.includes("Shift")) {
      unselectAllFiles();
    }
    selectFile(fileKey, windowKey);
  }, [
    fileKey,
    pressedKeys,
    selectFile,
    selectedFileSerials,
    serialKey,
    unselectAllFiles,
    windowKey,
  ]);

  // Double click: open file
  const handleDoubleClick = useCallback(() => {
    const winType = getWindowType(type, name);
    if (winType === null) return;

    if (windowKey === backgroundWindowKey) {
      // On background window: open a new window
      newWindow({
        targetKey: fileKey,
        type: winType,
        title: name,
        systemId,
      });
    } else if (winType === WindowType.Navigator) {
      // Navigator → Navigator: update in place
      setHighlightedFile(null);
      updateWindow({
        targetWindowKey: windowKey,
        targetFileKey: fileKey,
        title: name,
      });
    } else {
      // Non-navigator (image, video, audio, etc.): open a new window
      newWindow({
        targetKey: fileKey,
        type: winType,
        title: name,
        systemId,
      });
    }
  }, [
    backgroundWindowKey,
    fileKey,
    name,
    newWindow,
    setHighlightedFile,
    systemId,
    type,
    updateWindow,
    windowKey,
  ]);

  return (
    <div className={`full-size ${styles.container}`}>
      <li
        className={`${styles.item_wrapper}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          backgroundColor:
            (selectedFileSerials.includes(serialKey) &&
              (backgroundFile ? selectedFileBackground : selectedFile)) ||
            "transparent",
        }}
      >
        <div className={`full-size flex-center ${styles.item}`} ref={fileRef}>
          {icon && (
            <FileIcon
              ref={iconRef}
              onClick={handleSingleClick}
              onDoubleClick={handleDoubleClick}
              icon={icon}
              fileName={name}
              hasContent={
                type === VirtualFileType.Trash ? !!trashLsQuery.data : false
              }
            />
          )}
          <FileName
            name={name}
            fileKey={fileKey}
            windowKey={windowKey}
            backgroundFile={backgroundFile}
          />
        </div>
      </li>
    </div>
  );
});
