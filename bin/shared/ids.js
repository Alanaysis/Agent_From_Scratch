import { randomUUID } from "crypto";
export function createId(prefix = "id") {
    return `${prefix}-${randomUUID()}`;
}
