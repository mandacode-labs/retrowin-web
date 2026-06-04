"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRootDirectory, useUser } from "@/api/hooks";
import DragFileContainer from "@/components/drag/drag_file_container";
import FileContainer from "@/components/file/file_container";
import Background from "@/components/layout/background";
import Navbar from "@/components/layout/navbar/navbar_container";
import MenuBox from "@/components/menu/menu_box";
import SelectBoxContainer from "@/components/select/select_box_container";
import Window from "@/components/window/window";
import { useWindowStore } from "@/store/window.store";
import { WindowType } from "@/types/window";
import { createWindowKey } from "@/utils/random_key";
import styles from "./page.module.css";

export default function SystemPage() {
  const router = useRouter();
  const params = useParams();
  const systemId = params.system_id as string;

  // Constants
  const backgroundWindowKey = useMemo(() => createWindowKey(), []);

  // States
  const [homeKey, setHomeKey] = useState<string | null>(null);
  const [currentPath, _setCurrentPath] = useState<string>("/home");

  // Store states
  const windows = useWindowStore((state) => state.windows);
  // Store actions
  const newBackgroundWindow = useWindowStore((state) => state.newWindow);
  const setCurrentWindow = useWindowStore((state) => state.setCurrentWindow);

  // Refs
  const backgroundWindowRef = useRef<HTMLDivElement>(null);

  // Get current user
  const getUserQuery = useUser();

  // Get root directory for the system
  const rootDirectoryQuery = useRootDirectory(systemId);

  // Redirect to login on auth error (401)
  useEffect(() => {
    if (getUserQuery.data?.status === 401) {
      console.error("Auth failed: 401 Unauthorized");
      router.push("/login");
    }
  }, [getUserQuery.data?.status, router]);

  // Create background window when homeKey and systemId are ready
  useEffect(() => {
    if (homeKey && systemId) {
      newBackgroundWindow({
        targetKey: currentPath,
        type: WindowType.Background,
        title: "background",
        key: backgroundWindowKey,
        systemId: systemId,
      });
    }
  }, [
    backgroundWindowKey,
    newBackgroundWindow,
    homeKey,
    systemId,
    currentPath,
  ]);

  // Set homeKey when root directory is loaded
  useEffect(() => {
    if (rootDirectoryQuery.isSuccess && rootDirectoryQuery.data) {
      setHomeKey(rootDirectoryQuery.data.id);
    }
  }, [rootDirectoryQuery.data, rootDirectoryQuery.isSuccess]);

  const onMouseEnter = useCallback(() => {
    setCurrentWindow({
      key: backgroundWindowKey,
      windowRef: backgroundWindowRef,
      contentRef: null,
      headerRef: null,
    });
  }, [backgroundWindowKey, setCurrentWindow]);

  // Show loading while checking auth or loading data
  if (
    getUserQuery.isLoading ||
    getUserQuery.isPending ||
    !homeKey ||
    !systemId
  ) {
    return <div className="flex-center full-size">Loading...</div>;
  }

  return (
    <div
      className={`${styles.page} flex-center full-size`}
      onContextMenu={(e) => e.preventDefault()}
      role="application"
    >
      <Background>
        <MenuBox>
          <SelectBoxContainer>
            <DragFileContainer>
              <section
                ref={backgroundWindowRef}
                className={`full-size flex-center ${styles.background_window}`}
                onMouseEnter={onMouseEnter}
                aria-label="background workspace"
              >
                <FileContainer
                  windowKey={backgroundWindowKey}
                  systemId={systemId}
                  path={currentPath}
                  upload
                  trash
                  backgroundFile
                />
              </section>
              {windows
                .filter((w) => w.type !== WindowType.Background)
                .map((window) => (
                  <Window key={window.key} windowKey={window.key} />
                ))}
            </DragFileContainer>
          </SelectBoxContainer>
        </MenuBox>
      </Background>
      <Navbar windows={windows} systemId={systemId} />
    </div>
  );
}
