import { getDb } from "@ambl/database";

export { getDb };

export function db() {
  return getDb();
}