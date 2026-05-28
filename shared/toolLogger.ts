const TRUNCATE_LENGTH = 500;

function truncate(value: unknown): string {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (!str) return "";
  return str.length > TRUNCATE_LENGTH
    ? `${str.slice(0, TRUNCATE_LENGTH)}…`
    : str;
}

function now(): number {
  return Date.now();
}

export function logToolStart(toolName: string, toolUseId: string, input: unknown): void {
  console.debug(
    `[Tool] START ${toolName} (${toolUseId.slice(0, 8)}) input=${truncate(input)}`,
  );
}

export function logToolResult(
  toolName: string,
  toolUseId: string,
  durationMs: number,
  result?: unknown,
): void {
  console.debug(
    `[Tool] OK ${toolName} (${toolUseId.slice(0, 8)}) ${durationMs}ms result=${truncate(result)}`,
  );
}

export function logToolError(
  toolName: string,
  toolUseId: string,
  durationMs: number,
  error: unknown,
): void {
  const msg = error instanceof Error ? error.message : String(error);
  console.warn(
    `[Tool] ERROR ${toolName} (${toolUseId.slice(0, 8)}) ${durationMs}ms error=${truncate(msg)}`,
  );
}

export function logToolException(
  toolName: string,
  toolUseId: string,
  durationMs: number,
  error: unknown,
): void {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(
    `[Tool] EXCEPTION ${toolName} (${toolUseId.slice(0, 8)}) ${durationMs}ms error=${truncate(msg)}`,
  );
}

export { now as toolNow };
