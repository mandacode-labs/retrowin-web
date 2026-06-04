import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCreateSystemMutationOptions,
  getGetUserQueryOptions,
  getListSystemsQueryOptions,
  getLogoutMutationOptions,
} from "@/api/generated";

export function useUser() {
  return useQuery({
    ...getGetUserQueryOptions(),
    retry: false,
  });
}

export function useSystems(enabled: boolean) {
  return useQuery({
    ...getListSystemsQueryOptions(),
    retry: false,
    select: (response) => {
      if (response.status === 200) {
        return response.data.systems;
      }
      return [];
    },
    enabled,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    ...getLogoutMutationOptions(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["/api/user"] });
    },
  });
}

export function useCreateSystem() {
  const queryClient = useQueryClient();

  return useMutation({
    ...getCreateSystemMutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/systems"] });
    },
  });
}
