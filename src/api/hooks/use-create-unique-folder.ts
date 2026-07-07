import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { ls } from "@/api/generated";
import { getMkdirMutationOptions } from "@/api/generated";
import { isFsQuery } from "@/api/utils";
import { uniqueFolderName } from "@/utils/folder_name";

/**
 * Hook that creates a "New Folder" with XP-style automatic naming
 * (New Folder, New Folder (2), New Folder (3), ...).
 *
 * It reads the parent's existing entries to pick the smallest unused name
 * and falls back to "(N+1)" if the backend reports a 409 conflict.
 */
export function useCreateUniqueFolder() {
  const queryClient = useQueryClient();
  const mkdirMutation = useMutation({
    ...getMkdirMutationOptions(),
  });

  const createUniqueFolder = useCallback(
    async (systemId: string, parentPath: string) => {
      if (!systemId || !parentPath) return;

      const readDir = await ls(systemId, { path: parentPath });
      const existing =
        readDir.status === 200 && "entries" in readDir.data
          ? readDir.data.entries.map((e) => e.name)
          : [];

      const folderName = uniqueFolderName(existing);
      const fullPath = `${parentPath === "/" ? "" : parentPath}/${folderName}`;

      try {
        await mkdirMutation.mutateAsync({
          systemId,
          data: { path: fullPath, mode: 0o755 },
        });
      } catch (error) {
        const status = (error as { status?: number })?.status;
        if (status !== 409) throw error;

        // Backend rejected (race or duplicate). Retry once with a guaranteed-unique name.
        const retryName = uniqueFolderName([...existing, folderName]);
        const retryPath = `${parentPath === "/" ? "" : parentPath}/${retryName}`;
        await mkdirMutation.mutateAsync({
          systemId,
          data: { path: retryPath, mode: 0o755 },
        });
      }

      queryClient.invalidateQueries({ predicate: isFsQuery });
    },
    [mkdirMutation, queryClient]
  );

  return createUniqueFolder;
}