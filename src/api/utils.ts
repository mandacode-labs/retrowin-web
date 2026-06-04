import type { Query } from "@tanstack/react-query";
import type { ErrorError } from "@/api/generated/model";

export interface ApiError {
  status: number;
  code: string;
  message: string;
  raw?: unknown;
}

export function parseApiError(error: unknown): ApiError {
  if (error instanceof Response) {
    return {
      status: error.status,
      code: `HTTP_${error.status}`,
      message: error.statusText,
      raw: error,
    };
  }

  if (typeof error === "object" && error !== null) {
    const err = error as { data?: { error?: ErrorError }; status?: number };
    if (err.data?.error) {
      return {
        status: err.status ?? 500,
        code: err.data.error.type,
        message: err.data.error.message,
        raw: error,
      };
    }
  }

  return {
    status: 500,
    code: "UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : "Unknown error",
    raw: error,
  };
}

export function isAuthError(error: ApiError): boolean {
  return error.status === 401 || error.status === 403;
}

export function isNotFoundError(error: ApiError): boolean {
  return error.status === 404;
}

export function isConflictError(error: ApiError): boolean {
  return error.status === 409;
}

export const FS_PREFIXES = ["/api/fs/", "/api/syscall/"] as const;
export const LS_SUFFIX = "/ls";
export const STAT_SUFFIX = "/stat";

export function isFsQuery(query: Query): boolean {
  const queryKey = query.queryKey[0] as string;
  return (
    FS_PREFIXES.some((prefix) => queryKey.startsWith(prefix)) &&
    (queryKey.endsWith(LS_SUFFIX) || queryKey.endsWith(STAT_SUFFIX))
  );
}

export function isSystemQuery(query: Query, systemId?: string): boolean {
  const queryKey = query.queryKey[0] as string;
  if (systemId) {
    return queryKey.includes(`/api/systems/${systemId}`);
  }
  return queryKey.startsWith("/api/systems/");
}

export function isUploadQuery(query: Query): boolean {
  const queryKey = query.queryKey[0] as string;
  return queryKey.includes("/upload/");
}
