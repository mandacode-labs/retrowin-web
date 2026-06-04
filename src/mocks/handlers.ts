import { HttpResponse, http } from "msw";
import { BackendFileType, type FileType } from "@/types/file";
import {
  createFile,
  createNewSystem,
  deleteFile,
  deleteSystem,
  getChildren,
  getFile,
  getFileByPath,
  getSystem,
  listSystems,
  ROOT_KEY,
  updateFileName,
  updateFileParent,
} from "./data";

// Mock system ID
const MOCK_SYSTEM_ID = "sys-mock-123";

// Mock authentication state
let isAuthenticated = true;

// Helper to reset auth state (useful for testing)
export const resetMockAuth = (authenticated = true) => {
  isAuthenticated = authenticated;
};

// Helper function to convert MockFile to Inode format
function toInode(mockFile: {
  fileKey: string;
  fileName: string;
  type: FileType;
  createDate: string;
  updateDate: string;
  byteSize: number;
  parentKey: string | null;
}) {
  // File type: directory (0o040000) or regular file (0o0100000)
  const isDirectory = mockFile.type === BackendFileType.Directory;
  const mode = isDirectory ? 0o040755 : 0o0100644;

  return {
    id: mockFile.fileKey,
    systemId: MOCK_SYSTEM_ID,
    mode,
    uid: 1000,
    gid: 1000,
    size: mockFile.byteSize,
    linkCount: 1,
    flags: 0,
    mtime: mockFile.updateDate,
    ctime: mockFile.createDate,
    createdAt: mockFile.createDate,
  };
}

export const handlers = [
  // Health check
  http.get("/api/health", () => {
    return HttpResponse.json({
      status: "healthy",
      version: "0.2.0",
    });
  }),

  // Auth endpoints
  http.get("/api/auth/login", () => {
    return HttpResponse.json({
      authorizationUrl: "https://mock-keycloak.example.com/auth",
      state: "mock-state-123",
    });
  }),

  http.post("/api/auth/callback", async () => {
    isAuthenticated = true;
    return HttpResponse.json({
      sessionId: "mock-session-id",
      userId: "user-123",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
  }),

  http.post("/api/auth/logout", () => {
    isAuthenticated = false;
    return HttpResponse.json({ logoutUrl: "" });
  }),

  // User endpoints
  http.get("/api/user", () => {
    if (!isAuthenticated) {
      return HttpResponse.json(
        { error: { type: "unauthorized", message: "Not authenticated" } },
        { status: 401 }
      );
    }
    return HttpResponse.json({
      user: {
        id: "user-123",
        provider: "keycloak" as const,
        providerId: "mock-provider-id",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }),

  http.delete("/api/user", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // System endpoints
  http.get("/api/systems", () => {
    const systems = listSystems();
    return HttpResponse.json({
      systems,
    });
  }),

  http.post("/api/systems", async ({ request }) => {
    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
    };
    const { name, description } = body;

    if (!name?.trim()) {
      return HttpResponse.json(
        { error: { type: "bad_request", message: "name is required" } },
        { status: 400 }
      );
    }

    const newSystem = createNewSystem(name.trim(), description);
    return HttpResponse.json(
      {
        system: newSystem,
      },
      { status: 201 }
    );
  }),

  http.get("/api/systems/:systemId", ({ params }) => {
    const system = getSystem(params.systemId as string);
    if (!system) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      system,
    });
  }),

  http.delete("/api/systems/:systemId", ({ params }) => {
    const systemId = params.systemId as string;
    const system = getSystem(systemId);
    if (!system) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }
    deleteSystem(systemId);
    return new HttpResponse(null, { status: 204 });
  }),

  // Filesystem endpoints - Get root directory
  http.get("/api/fs/:systemId/root", ({ params }) => {
    if (params.systemId !== MOCK_SYSTEM_ID) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }

    const root = getFile(ROOT_KEY);
    if (!root) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "Root not found" } },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      inode: toInode(root),
    });
  }),

  // Filesystem endpoints - Stat path
  http.get("/api/fs/:systemId/stat", ({ params, request }) => {
    if (params.systemId !== MOCK_SYSTEM_ID) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const path = url.searchParams.get("path") || "/";

    const file = getFileByPath(path);
    if (!file) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "File not found" } },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      inode: toInode(file),
    });
  }),

  // Filesystem endpoints - List directory (ls)
  http.get("/api/fs/:systemId/ls", ({ params, request }) => {
    if (params.systemId !== MOCK_SYSTEM_ID) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const path = url.searchParams.get("path") || "/";

    const file = getFileByPath(path);
    if (!file) {
      return HttpResponse.json({
        entries: [],
      });
    }

    const children = getChildren(file.fileKey);

    return HttpResponse.json({
      entries: children.map((child) => ({
        name: child.fileName,
        inodeId: child.fileKey,
        fileType:
          child.type === BackendFileType.Directory
            ? 4 // DT_DIR
            : child.type === BackendFileType.Object
              ? 3 // DT_OBJ
              : 8, // DT_REG
      })),
    });
  }),

  // Syscall endpoints - Create directory
  http.post("/api/syscall/:systemId/mkdir", async ({ params, request }) => {
    if (params.systemId !== MOCK_SYSTEM_ID) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }

    const body = (await request.json()) as { path?: string; mode?: number };
    const { path: requestedPath } = body;

    if (!requestedPath) {
      return HttpResponse.json(
        { error: { type: "bad_request", message: "path is required" } },
        { status: 400 }
      );
    }

    // Extract parent path and new directory name
    const parts = requestedPath.split("/").filter(Boolean);
    const dirName = parts.pop() || "New Folder";
    const parentPath = parts.length > 0 ? `/${parts.join("/")}` : "/";

    // Find parent
    const parent = getFileByPath(parentPath);
    if (!parent) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "Parent not found" } },
        { status: 404 }
      );
    }

    const newFile = createFile(
      parent.fileKey,
      dirName,
      BackendFileType.Directory as FileType
    );
    if (!newFile) {
      return HttpResponse.json(
        {
          error: {
            type: "internal_error",
            message: "Failed to create directory",
          },
        },
        { status: 500 }
      );
    }

    return HttpResponse.json(
      {
        inode: toInode(newFile),
      },
      { status: 201 }
    );
  }),

  // Syscall endpoints - Rename (same directory)
  http.post("/api/syscall/:systemId/rename", async ({ params, request }) => {
    if (params.systemId !== MOCK_SYSTEM_ID) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }

    const body = (await request.json()) as { path?: string; newName?: string };
    const { path: fromPath, newName } = body;

    if (!fromPath || !newName) {
      return HttpResponse.json(
        {
          error: {
            type: "bad_request",
            message: "path and newName are required",
          },
        },
        { status: 400 }
      );
    }

    const sourceFile = getFileByPath(fromPath);
    if (!sourceFile) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "Source file not found" } },
        { status: 404 }
      );
    }

    // Update file name (keeps same parent)
    const updated = updateFileName(sourceFile.fileKey, newName);
    if (!updated) {
      return HttpResponse.json(
        { error: { type: "internal_error", message: "Failed to rename file" } },
        { status: 500 }
      );
    }

    return HttpResponse.json({
      inode: toInode(updated),
    });
  }),

  // Syscall endpoints - Create symlink (ln)
  http.post("/api/syscall/:systemId/ln", async ({ params, request }) => {
    if (params.systemId !== MOCK_SYSTEM_ID) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      target?: string;
      linkPath?: string;
    };
    const { target, linkPath } = body;

    if (!target || !linkPath) {
      return HttpResponse.json(
        {
          error: {
            type: "bad_request",
            message: "target and linkPath are required",
          },
        },
        { status: 400 }
      );
    }

    const targetFile = getFileByPath(target);
    if (!targetFile) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "Target not found" } },
        { status: 404 }
      );
    }

    // Extract parent path and link name
    const parts = linkPath.split("/").filter(Boolean);
    const linkName = parts.pop() || "link";
    const parentPath = parts.length > 0 ? `/${parts.join("/")}` : "/";

    const parent = getFileByPath(parentPath);
    if (!parent) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "Parent not found" } },
        { status: 404 }
      );
    }

    // Create symlink file
    const newLink = createFile(
      parent.fileKey,
      linkName,
      BackendFileType.Symlink as FileType
    );
    if (!newLink) {
      return HttpResponse.json(
        {
          error: {
            type: "internal_error",
            message: "Failed to create symlink",
          },
        },
        { status: 500 }
      );
    }

    return HttpResponse.json(
      {
        inode: toInode(newLink),
      },
      { status: 201 }
    );
  }),

  // Syscall endpoints - Delete (unlink)
  http.delete("/api/syscall/:systemId/unlink", ({ params, request }) => {
    if (params.systemId !== MOCK_SYSTEM_ID) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const path = url.searchParams.get("path") || "";

    const file = getFileByPath(path);
    if (!file) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "File not found" } },
        { status: 404 }
      );
    }

    deleteFile(file.fileKey);

    return new HttpResponse(null, { status: 204 });
  }),

  // Upload endpoints - Initiate upload
  http.post(
    "/api/fs/:systemId/upload/initiate",
    async ({ params, request }) => {
      if (params.systemId !== MOCK_SYSTEM_ID) {
        return HttpResponse.json(
          { error: { type: "not_found", message: "System not found" } },
          { status: 404 }
        );
      }

      const body = (await request.json()) as {
        path?: string;
        size?: number;
        checksum?: string;
        idempotencyKey?: string;
      };
      const { path: requestedPath } = body;

      if (!requestedPath) {
        return HttpResponse.json(
          { error: { type: "bad_request", message: "path is required" } },
          { status: 400 }
        );
      }

      const objectId = `obj-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      return HttpResponse.json(
        {
          uploadSession: {
            objectId,
            uploadUrl: "https://mock-storage.example.com/upload",
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
        },
        { status: 201 }
      );
    }
  ),

  // Upload endpoints - Complete upload
  http.post(
    "/api/fs/:systemId/upload/complete",
    async ({ params, request }) => {
      if (params.systemId !== MOCK_SYSTEM_ID) {
        return HttpResponse.json(
          { error: { type: "not_found", message: "System not found" } },
          { status: 404 }
        );
      }

      const body = (await request.json()) as {
        objectId?: string;
        path?: string;
      };
      const { path: requestedPath, objectId } = body;

      if (!requestedPath || !objectId) {
        return HttpResponse.json(
          {
            error: {
              type: "bad_request",
              message: "objectId and path are required",
            },
          },
          { status: 400 }
        );
      }

      // Extract parent path and file name
      const parts = requestedPath.split("/").filter(Boolean);
      const fileName = parts.pop() || "uploaded-file";
      const parentPath = parts.length > 0 ? `/${parts.join("/")}` : "/";

      // Find parent
      const parent = getFileByPath(parentPath);
      if (!parent) {
        return HttpResponse.json(
          { error: { type: "not_found", message: "Parent not found" } },
          { status: 404 }
        );
      }

      // Create a new file entry
      const newFile = createFile(
        parent.fileKey,
        fileName,
        BackendFileType.Regular as FileType
      );

      if (!newFile) {
        return HttpResponse.json(
          {
            error: { type: "internal_error", message: "Failed to create file" },
          },
          { status: 500 }
        );
      }

      return HttpResponse.json(
        {
          inode: toInode(newFile),
        },
        { status: 201 }
      );
    }
  ),

  // Syscall endpoints - List directory (ls)
  http.get("/api/syscall/:systemId/ls", ({ params, request }) => {
    if (params.systemId !== MOCK_SYSTEM_ID) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const path = url.searchParams.get("path") || "/";

    const file = getFileByPath(path);
    if (!file) {
      return HttpResponse.json({
        entries: [],
      });
    }

    const children = getChildren(file.fileKey);

    return HttpResponse.json({
      entries: children.map((child) => ({
        name: child.fileName,
        inodeId: child.fileKey,
        fileType:
          child.type === BackendFileType.Directory
            ? 4
            : child.type === BackendFileType.Object
              ? 3
              : child.type === BackendFileType.Symlink
                ? 10
                : 8,
      })),
    });
  }),

  // Syscall endpoints - Batch remove (rm)
  http.post("/api/syscall/:systemId/rm", async ({ params, request }) => {
    if (params.systemId !== MOCK_SYSTEM_ID) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      paths?: string[];
      recursive?: boolean;
    };
    const paths = body.paths || [];

    const deleted: string[] = [];
    const errors: { path: string; error: string }[] = [];

    for (const p of paths) {
      const file = getFileByPath(p);
      if (file) {
        deleteFile(file.fileKey);
        deleted.push(p);
      } else {
        errors.push({ path: p, error: "not found" });
      }
    }

    return HttpResponse.json({
      deleted,
      ...(errors.length > 0 ? { errors } : {}),
    });
  }),

  // Syscall endpoints - Batch move (mv)
  http.post("/api/syscall/:systemId/mv", async ({ params, request }) => {
    if (params.systemId !== MOCK_SYSTEM_ID) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      sources?: string[];
      destination?: string;
    };
    const { sources = [], destination } = body;

    if (!destination) {
      return HttpResponse.json(
        { error: { type: "bad_request", message: "destination is required" } },
        { status: 400 }
      );
    }

    const moved: string[] = [];
    const errors: { path: string; error: string }[] = [];

    // Check if destination is an existing directory
    const destDir = getFileByPath(destination);

    for (const sourcePath of sources) {
      const sourceFile = getFileByPath(sourcePath);
      if (!sourceFile) {
        errors.push({ path: sourcePath, error: "not found" });
        continue;
      }

      let targetParent: ReturnType<typeof getFileByPath>;
      let newName: string;

      if (destDir && destDir.type === BackendFileType.Directory) {
        targetParent = destDir;
        newName = sourceFile.fileName;
      } else {
        const destParts = destination.split("/").filter(Boolean);
        newName = destParts.pop() || sourceFile.fileName;
        const targetParentPath =
          destParts.length > 0 ? `/${destParts.join("/")}` : "/";
        const possibleParent = getFileByPath(targetParentPath);
        if (!possibleParent) {
          errors.push({ path: sourcePath, error: "target parent not found" });
          continue;
        }
        targetParent = possibleParent;
      }

      const updated = updateFileParent(
        sourceFile.fileKey,
        targetParent.fileKey
      );
      if (updated) {
        updateFileName(updated.fileKey, newName);
        moved.push(sourcePath);
      } else {
        errors.push({ path: sourcePath, error: "move failed" });
      }
    }

    return HttpResponse.json({
      moved,
      ...(errors.length > 0 ? { errors } : {}),
    });
  }),

  // Download endpoints - Get download URL
  http.get("/api/fs/:systemId/download", ({ params, request }) => {
    if (params.systemId !== MOCK_SYSTEM_ID) {
      return HttpResponse.json(
        { error: { type: "not_found", message: "System not found" } },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const filePath = url.searchParams.get("path") || "/";
    const fileName = filePath.split("/").pop() || "file";
    const ext = fileName.split(".").pop()?.toLowerCase() || "";

    // Serve actual mock media files from public directory
    if (
      [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(`.${ext}`) ||
      ext === "png" ||
      ext === "jpg" ||
      ext === "jpeg"
    ) {
      return HttpResponse.json({
        downloadUrl: {
          downloadUrl: "/mock-media/test-image.png",
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });
    }
    if (
      [".mp4", ".webm", ".mov"].includes(`.${ext}`) ||
      ext === "mp4" ||
      ext === "webm"
    ) {
      return HttpResponse.json({
        downloadUrl: {
          downloadUrl: "/mock-media/test-video.mp4",
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });
    }

    // Default: data URL for other files
    const mockContent = `Mock file content for ${fileName}`;
    const dataUrl = `data:application/octet-stream;base64,${btoa(mockContent)}`;
    return HttpResponse.json({
      downloadUrl: {
        downloadUrl: dataUrl,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    });
  }),
];
