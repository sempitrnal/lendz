import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "borrower-notes";
const PAGE_SIZE = 200;
const CONCURRENCY = 5;

/**
 * Safely converts base64 data URL to Buffer
 */
function base64ToBuffer(data: string): Buffer {
  const cleaned = data.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(cleaned, "base64");
}

/**
 * Simple concurrency runner
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  const queue = [...items];
  const workers: Promise<void>[] = [];

  const runner = async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
    }
  };

  for (let i = 0; i < limit; i++) {
    workers.push(runner());
  }

  await Promise.all(workers);
}

async function migratePage(from: number, to: number) {
  const { data: notes, error } = await supabase
    .from("borrower_notes")
    .select("id, preview_image, preview_img_url")
    .range(from, to);

  if (error) throw error;

  return notes ?? [];
}

async function processNote(note: any) {
  try {
    // ✅ skip if already migrated
    if (note.preview_img_url) {
      console.log(`Skipping (already migrated): ${note.id}`);
      return;
    }

    if (!note.preview_image) return;

    const buffer = base64ToBuffer(note.preview_image);

    // stable file path (idempotent)
    const filePath = `${note.id}.png`;

    // 1. upload
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload failed:", note.id, uploadError.message);
      return;
    }

    // 2. public URL
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    // 3. update DB
    const { error: updateError } = await supabase
      .from("borrower_notes")
      .update({
        preview_img_url: publicUrl,
      })
      .eq("id", note.id);

    if (updateError) {
      console.error("DB update failed:", note.id, updateError.message);
      return;
    }

    console.log(`Migrated: ${note.id}`);
  } catch (err) {
    console.error("Failed:", note.id, err);
  }
}

async function migrate() {
  console.log("Starting migration...");

  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    console.log(`Fetching rows ${from} - ${to}`);

    const notes = await migratePage(from, to);

    if (!notes.length) break;

    await runWithConcurrency(notes, CONCURRENCY, processNote);

    from += PAGE_SIZE;
  }

  console.log("✅ Migration complete");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});