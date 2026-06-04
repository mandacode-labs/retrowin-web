import { useCallback, useEffect, useRef, useState } from "react";
import { useMoveFiles } from "@/api/hooks";
import { useFileStore } from "@/store/file.store";
import { useEventStore } from "@/store/ui.store";
import { useWindowStore } from "@/store/window.store";
import { BackendFileType } from "@/types/file";
import { WindowType } from "@/types/window";
import { isDragTarget } from "@/utils/file_type";
import { parseSerialKey } from "@/utils/serial_key";
import styles from "./drag_file_container.module.css";

export default function DragFileContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  // States
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingReady, setIsDraggingReady] = useState(false);
  const [displayDraggingElements, setDisplayDraggingElements] = useState(false);
  const [pointerMoved, setPointerMoved] = useState(false);

  // Refs
  const draggingFileRef = useRef<HTMLDivElement>(null);

  // Store states
  const currentWindow = useWindowStore((state) => state.currentWindow);
  const menuRef = useFileStore((state) => state.menuRef);
  const highlightedFile = useFileStore((state) => state.highlightedFile);
  const selectedFileSerials = useFileStore(
    (state) => state.selectedFileSerials
  );
  const fileIconRefs = useFileStore((state) => state.fileIconRefs);
  const pressedKeys = useEventStore((state) => state.pressedKeys);

  // Store actions
  const findWindow = useWindowStore((state) => state.findWindow);
  const isFileKeySelected = useFileStore((state) => state.isFileKeySelected);
  const selectFile = useFileStore((state) => state.selectFile);
  const unselectAllFiles = useFileStore((state) => state.unselectAllFiles);

  // Mutations
  const mvMutation = useMoveFiles();

  // Drag file start
  const dragFileStart = useCallback(
    (e: MouseEvent) => {
      if (menuRef?.current?.contains(e.target as Node)) return;

      if (!highlightedFile) return;
      else if (highlightedFile?.ref.current?.contains(e.target as Node)) {
        if (
          !isFileKeySelected(highlightedFile.fileKey) &&
          !pressedKeys.includes("Shift")
        ) {
          unselectAllFiles();
        }
        selectFile(highlightedFile.fileKey, highlightedFile.windowKey);
      }
      setPointerMoved(false);
      setStart({ x: e.clientX, y: e.clientY });
      setIsDraggingReady(true);
    },
    [
      highlightedFile,
      isFileKeySelected,
      menuRef,
      pressedKeys,
      selectFile,
      unselectAllFiles,
    ]
  );

  // Create dragging file clone
  const createDraggingFile = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (
        highlightedFile?.ref.current &&
        isDraggingReady &&
        !isDragging &&
        Math.abs(e.clientX - start.x) > 5 &&
        Math.abs(e.clientY - start.y) > 5
      ) {
        document.body.style.cursor = "grabbing";
        setIsDragging(true);
        setDisplayDraggingElements(true);
        setPointerMoved(true);

        let count = 0;
        let width = 0;
        selectedFileSerials.forEach((serialKey) => {
          const fileIconRef = fileIconRefs.get(serialKey);
          if (fileIconRef?.current && count < 4) {
            const fileRect = fileIconRef.current.getBoundingClientRect();
            const clone = fileIconRef.current.cloneNode(true) as HTMLElement;
            clone.style.position = "absolute";
            clone.style.left = `${-fileRect.width / 2}px`;
            clone.style.top = `${-fileRect.height - count * 5}px`;
            clone.style.zIndex = `${-count}`;
            draggingFileRef.current?.appendChild(clone);

            if (count === 0) {
              width = fileRect.width;
            }
            count++;
          }
        });

        const countElement = document.createElement("div");
        countElement.innerText = `${selectedFileSerials.length}`;
        countElement.className = styles.dragging_file_count;
        countElement.style.left = `${width / 2 - 12}px`;
        draggingFileRef.current?.appendChild(countElement);
      }
    },
    [
      fileIconRefs,
      highlightedFile?.ref,
      isDragging,
      isDraggingReady,
      selectedFileSerials,
      start.x,
      start.y,
    ]
  );

  // Drag file
  const dragFile = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      if (!draggingFileRef.current) return;
      e.preventDefault();
      draggingFileRef.current.style.left = `${e.clientX}px`;
      draggingFileRef.current.style.top = `${e.clientY}px`;
    },
    [isDragging]
  );

  // Drag file end
  const dragFileEnd = useCallback(async () => {
    console.log("[DragFileContainer] dragFileEnd called", {
      isDragging,
      pointerMoved,
    });
    setIsDragging(false);
    setIsDraggingReady(false);
    setDisplayDraggingElements(false);
    if (!draggingFileRef.current) return;
    document.body.style.cursor = "default";
    draggingFileRef.current.innerHTML = "";
    document.body.style.cursor = "default";
    let targetPath: string | null = null;

    // Set target path as the current window key
    if (currentWindow?.windowRef.current) {
      const window = findWindow(currentWindow.key);
      if (
        window &&
        (window.type === WindowType.Background ||
          window.type === WindowType.Navigator)
      ) {
        targetPath = window.targetKey;
      }
    }

    // Set the target folder path as the highlighted file path
    if (highlightedFile && isDragTarget(highlightedFile.type)) {
      targetPath = highlightedFile.fileKey;
    } else if (
      highlightedFile &&
      highlightedFile.type === BackendFileType.Symlink
    ) {
      targetPath = null;
    } else if (highlightedFile) {
      targetPath = null;
    }

    // Move the selected elements to the target folder
    if (targetPath && pointerMoved) {
      // Get the file paths of the selected files
      const filePaths = selectedFileSerials
        .map((serialKey) => parseSerialKey(serialKey).fileKey)
        .filter((p) => p !== targetPath);

      if (filePaths.length > 0) {
        // Get system ID
        const window = findWindow(currentWindow?.key || "");
        const systemId = window?.systemId || "";

        // Use batch mv API to move all files at once
        await mvMutation.mutateAsync({
          systemId,
          data: { sources: filePaths, destination: targetPath },
        });
      }

      unselectAllFiles();
    }
  }, [
    currentWindow,
    findWindow,
    highlightedFile,
    pointerMoved,
    selectedFileSerials,
    unselectAllFiles,
    mvMutation,
    isDragging,
  ]);

  // Event listeners
  useEffect(() => {
    document.addEventListener("mousedown", dragFileStart);
    return () => {
      document.removeEventListener("mousedown", dragFileStart);
    };
  }, [dragFileStart]);

  useEffect(() => {
    document.addEventListener("mousemove", createDraggingFile);
    return () => {
      document.removeEventListener("mousemove", createDraggingFile);
    };
  }, [createDraggingFile]);

  useEffect(() => {
    document.addEventListener("mousemove", dragFile);
    return () => {
      document.removeEventListener("mousemove", dragFile);
    };
  }, [dragFile]);

  useEffect(() => {
    document.addEventListener("mouseup", dragFileEnd);
    return () => {
      document.removeEventListener("mouseup", dragFileEnd);
    };
  }, [dragFileEnd]);

  return (
    <div className="full-size">
      <div
        ref={draggingFileRef}
        hidden={!displayDraggingElements}
        className={`${styles.dragging_files}`}
      ></div>
      {children}
    </div>
  );
}
