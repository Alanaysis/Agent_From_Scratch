import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { join } from "path";
import { existsSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";

// Use createRequire to load CJS modules (gRPC uses require() internally)
const __require = createRequire(import.meta.url);

// Lazy-loaded gRPC modules (loaded on first use, not at import time)
let grpc: any = null;
let protoLoader: any = null;

async function ensureGrpcLoaded() {
  if (!grpc) {
    grpc = __require("@grpc/grpc-js");
  }
  if (!protoLoader) {
    protoLoader = __require("@grpc/proto-loader");
  }
}

export type GrpcClientInput = {
  protoFile: string;
  service: string;
  method: string;
  address: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, string>;
  deadline?: number;
};

export type GrpcClientOutput = {
  success: boolean;
  response: unknown;
  error?: string;
  durationMs: number;
};

// Cache loaded proto definitions with mtime for invalidation
const protoCache = new Map<string, { def: any; mtimeMs: number }>();

async function loadProto(protoPath: string): Promise<any> {
  await ensureGrpcLoaded();
  const { stat } = await import("fs/promises");
  const fileStat = await stat(protoPath).catch(() => null);
  const mtimeMs = fileStat?.mtimeMs || 0;

  const cached = protoCache.get(protoPath);
  if (cached && cached.mtimeMs === mtimeMs) return cached.def;

  const packageDef = await protoLoader!.load(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  protoCache.set(protoPath, { def: packageDef, mtimeMs });
  return packageDef;
}

function getServiceClient(
  packageDef: any,
  serviceName: string,
  address: string,
): any {
  const proto = grpc!.loadPackageDefinition(packageDef);

  // Navigate nested package path (e.g. "mypackage.MyService")
  const parts = serviceName.split(".");
  let current: any = proto;
  for (const part of parts) {
    if (current[part]) {
      current = current[part];
    } else {
      throw new Error(`Service "${serviceName}" not found in proto definition. Available: ${Object.keys(current).join(", ")}`);
    }
  }

  if (typeof current !== "function") {
    throw new Error(`"${serviceName}" is not a gRPC service constructor`);
  }

  return new current(address, grpc!.credentials.createInsecure());
}

function callMethod(
  client: any,
  methodName: string,
  payload: Record<string, unknown>,
  metadata: Record<string, string>,
  deadlineMs: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Find the method on the client
    const method = (client as any)[methodName];
    if (typeof method !== "function") {
      // List available methods
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client))
        .filter(m => typeof (client as any)[m] === "function" && !m.startsWith("_"))
        .filter(m => !["close", "getChannel", "waitForReady"].includes(m));
      reject(new Error(`Method "${methodName}" not found. Available: ${methods.join(", ")}`));
      return;
    }

    const meta = new grpc!.Metadata();
    for (const [key, value] of Object.entries(metadata)) {
      meta.add(key, value);
    }

    const deadline = new Date(Date.now() + deadlineMs);

    // Safety timeout — prevents hanging on streaming RPCs
    const timer = setTimeout(() => {
      reject(new Error(`gRPC call timed out after ${deadlineMs}ms (is this a streaming RPC? Only unary calls are supported)`));
    }, deadlineMs + 1000);

    method.call(client, payload, meta, { deadline }, (error: any, response: unknown) => {
      clearTimeout(timer);
      if (error) {
        reject(new Error(`gRPC error [${error.code}]: ${error.details || error.message}`));
      } else {
        resolve(response);
      }
    });
  });
}

export const GrpcClientTool: Tool<GrpcClientInput, GrpcClientOutput> = {
  name: "GrpcClient",
  inputSchema: null,
  outputSchema: null,

  async description() {
    return "Make a gRPC call to an external service. Requires a .proto file, service name, method name, and target address. Use this to communicate with external microservices.";
  },

  async call(
    args: GrpcClientInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<GrpcClientOutput>> {
    const startTime = Date.now();
    const deadline = args.deadline || 300000;
    const metadata = args.metadata || {};

    try {
      // Resolve proto file path
      const protoPath = args.protoFile.startsWith("/")
        ? args.protoFile
        : join(context.cwd, args.protoFile);

      if (!existsSync(protoPath)) {
        return {
          data: {
            success: false,
            response: null,
            error: `Proto file not found: ${protoPath}`,
            durationMs: Date.now() - startTime,
          },
        };
      }

      // Load proto and create client
      const packageDef = await loadProto(protoPath);
      const client = getServiceClient(packageDef, args.service, args.address);

      try {
        // Make the call
        const response = await callMethod(client, args.method, args.payload, metadata, deadline);

        return {
          data: {
            success: true,
            response,
            durationMs: Date.now() - startTime,
          },
        };
      } finally {
        client.close();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        data: {
          success: false,
          response: null,
          error: message,
          durationMs: Date.now() - startTime,
        },
      };
    }
  },

  async validateInput(input) {
    if (!input.protoFile || typeof input.protoFile !== "string") {
      return { result: false, message: "protoFile is required" };
    }
    if (!input.service || typeof input.service !== "string") {
      return { result: false, message: "service is required" };
    }
    if (!input.method || typeof input.method !== "string") {
      return { result: false, message: "method is required" };
    }
    if (!input.address || typeof input.address !== "string") {
      return { result: false, message: "address is required (host:port)" };
    }
    if (!input.address.match(/^[a-zA-Z0-9._-]+:\d+$/)) {
      return { result: false, message: "address must be in format host:port" };
    }
    if (!input.payload || typeof input.payload !== "object") {
      return { result: false, message: "payload is required (object)" };
    }
    return { result: true };
  },

  async checkPermissions() {
    return { behavior: "ask" as const, message: "gRPC call requires confirmation" };
  },

  isReadOnly() {
    return false;
  },

  isConcurrencySafe() {
    return false;
  },
};
