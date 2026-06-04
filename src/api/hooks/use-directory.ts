import { useQuery } from "@tanstack/react-query";
import {
  getLsQueryOptions,
  getStatPathQueryOptions,
  getGetRootDirectoryQueryOptions,
} from "@/api/generated";

export function useDirectory(systemId: string, path: string) {
  return useQuery({
    ...getLsQueryOptions(systemId, { path }),
    enabled: !!systemId && !!path,
    select: (response) => {
      if (response.status === 200 && "entries" in response.data) {
        return response.data.entries;
      }
      return [];
    },
  });
}

export function useFileInfo(systemId: string, path: string) {
  return useQuery({
    ...getStatPathQueryOptions(systemId, { path }),
    enabled: !!systemId && !!path,
    select: (response) => {
      if (response.status === 200) {
        return response.data.inode;
      }
      return null;
    },
  });
}

export function useRootDirectory(systemId: string) {
  return useQuery({
    ...getGetRootDirectoryQueryOptions(systemId),
    enabled: !!systemId,
    retry: false,
  });
}
