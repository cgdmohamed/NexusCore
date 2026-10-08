// One-off, opt-in conversion of profile pictures stored as base64 in the database into files under
// uploads/profiles. Safe to re-run. Dry run by default:
//   npx tsx scripts/migrate-profile-images.ts            # report only
//   npx tsx scripts/migrate-profile-images.ts --apply    # convert (take a database backup first)
import "dotenv/config";
import { pathToFileURL } from "url";
import { eq, like } from "drizzle-orm";
import { db, pool } from "../server/db";
import { employees } from "../shared/schema";
import { storeProfileImage, ProfileImageError } from "../server/profile-images";

export async function migrateProfileImages(apply: boolean, log: (message: string) => void = console.log) {
  const rows = await db.select({ id: employees.id, name: employees.firstName, profileImage: employees.profileImage }).from(employees).where(like(employees.profileImage, "data:%"));
  const result = { found: rows.length, converted: 0, skipped: 0, bytes: 0 };

  for (const row of rows) {
    const size = row.profileImage?.length ?? 0;
    result.bytes += size;
    if (!apply) {
      log(`would convert employee ${row.id} (${row.name}): ${Math.round(size / 1024)} KB`);
      continue;
    }
    try {
      const url = storeProfileImage(row.profileImage);
      await db.update(employees).set({ profileImage: url ?? null }).where(eq(employees.id, row.id));
      result.converted++;
      log(`converted employee ${row.id} (${row.name}) -> ${url}`);
    } catch (error) {
      result.skipped++;
      log(`skipped employee ${row.id} (${row.name}): ${error instanceof ProfileImageError ? error.message : String(error)}`);
    }
  }
  log(`${apply ? "applied" : "dry run"}: ${result.found} base64 picture(s), ${Math.round(result.bytes / 1024)} KB in the database, ${result.converted} converted, ${result.skipped} skipped`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrateProfileImages(process.argv.includes("--apply"))
    .then(() => pool.end())
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
