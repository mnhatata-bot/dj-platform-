import { z } from "zod";
import { fileTypeFromBuffer } from "file-type";
import { createHash } from "node:crypto";
import { authenticate, apiError } from "@/lib/server-auth";
export const maxDuration = 60;
const allowed = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "application/pdf",
  "application/zip",
];
export async function POST(request: Request) {
  try {
    const { db, user } = await authenticate(request);
    const input = z
      .object({
        key: z.string().max(200),
        name: z.string().min(1).max(160),
        alt: z.string().max(300),
      })
      .parse(await request.json());
    if (!input.key.startsWith(user.id + "/") || input.key.includes(".."))
      throw new Error("FORBIDDEN");
    const { data: file, error } = await db.storage
      .from("media")
      .download(input.key);
    if (error || !file) throw new Error("Upload not found");
    if (file.size > 26214400 || file.size === 0)
      throw new Error("File must be between 1 byte and 25 MB");
    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = await fileTypeFromBuffer(buffer);
    const mime =
      detected?.mime === "audio/vnd.wave" ? "audio/wav" : detected?.mime;
    const extension = input.key.split(".").pop()?.toLowerCase();
    const extensionMatches =
      detected &&
      (extension === detected.ext ||
        (detected.ext === "jpg" && extension === "jpeg"));
    if (!detected || !mime || !allowed.includes(mime) || !extensionMatches) {
      await db.storage.from("media").remove([input.key]);
      throw new Error("File contents do not match a supported extension");
    }
    const kind = mime.startsWith("image/")
      ? "IMAGE"
      : mime.startsWith("video/")
        ? "VIDEO"
        : mime.startsWith("audio/")
          ? "AUDIO"
          : mime === "application/pdf"
            ? "PDF"
            : "ZIP";
    const { data: existing } = await db
      .from("media_assets")
      .select("id")
      .eq("storage_key", input.key)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (existing) return Response.json(existing);
    const { data, error: saveError } = await db
      .from("media_assets")
      .insert({
        owner_user_id: user.id,
        kind,
        mime_type: mime,
        file_size: file.size,
        storage_key: input.key,
        visibility: "PRIVATE",
        metadata: {
          name: input.name,
          alt: input.alt,
          checksum: createHash("sha256").update(buffer).digest("hex"),
        },
      })
      .select("id")
      .single();
    if (saveError)
      throw new Error(
        "Could not register the uploaded asset. Retry completion.",
      );
    return Response.json(data);
  } catch (error) {
    return apiError(error);
  }
}
