#!/usr/bin/env bun
/**
 * Rewrites site.config.json in the current format when it's in an older one. The build already
 * upgrades an old config in memory; this saves the result, so the file matches the code after
 * an update from the template. Does nothing when the file is already current.
 * Usage: bun scripts/migrate-config.ts [path to site.config.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { CONFIG_FILE, migrateConfig, validateConfig } from "./lib/config";

/** Upgrades the file in place. Returns the versions, or null if nothing changed. Throws if the result is invalid. */
export function migrateConfigFile(file = CONFIG_FILE): { from: unknown; to: unknown } | null {
  const before = JSON.parse(readFileSync(file, "utf8")) as { schemaVersion?: unknown };
  const after = migrateConfig(before) as { schemaVersion?: unknown };
  if (after.schemaVersion === before.schemaVersion) return null;
  validateConfig(after);
  writeFileSync(file, JSON.stringify(after, null, 2) + "\n");
  return { from: before.schemaVersion, to: after.schemaVersion };
}

if (import.meta.main) {
  const done = migrateConfigFile(process.argv[2]);
  console.log(done ? `site.config.json: schemaVersion ${done.from} → ${done.to}` : "site.config.json is already in the current format");
}
