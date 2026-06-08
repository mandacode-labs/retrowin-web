import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMkdirMutationOptions,
  getMvMutationOptions,
  getRenameMutationOptions,
  getRmMutationOptions,
} from "@/api/generated";
import { isFsQuery } from "@/api/utils";

export function useMoveFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    ...getMvMutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: isFsQuery });
    },
  });
}

export function useDeleteFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    ...getRmMutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: isFsQuery });
    },
  });
}

export function useRenameFile() {
  const queryClient = useQueryClient();

  return useMutation({
    ...getRenameMutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: isFsQuery });
    },
  });
}

export function useCreateDirectory() {
  const queryClient = useQueryClient();

  return useMutation({
    ...getMkdirMutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: isFsQuery });
    },
  });
}
