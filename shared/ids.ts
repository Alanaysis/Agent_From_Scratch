import { randomUUID } from "crypto";

export function createId(prefix = "id"): string {
  return `${prefix}-${randomUUID()}`;
}
