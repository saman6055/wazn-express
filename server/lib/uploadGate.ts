import { TRPCError } from "@trpc/server";
import { withFix } from "@shared/fixAdvice";
import {
  base64Bytes,
  safeUploadExtension,
  uploadRefusal,
  UPLOAD_REFUSAL_TEXT,
  type UploadPurpose,
} from "@shared/uploadRule";

/**
 * The one door every uploaded file comes through on the server.
 *
 * Decodes the base64, measures it, asks shared/uploadRule whether it may be
 * stored, and hands back the bytes with the extension the stored copy gets —
 * never the uploader's own, which could name anything. A procedure that takes
 * a file calls this and nothing else; the guard test (upload-doors.test.ts)
 * holds every one of them to it.
 */
export function acceptUpload(input: {
  fileName: string;
  contentType?: string;
  base64: string;
  purpose: UploadPurpose;
}): { buffer: Buffer; ext: string } {
  const refusal = uploadRefusal({
    fileName: input.fileName,
    contentType: input.contentType,
    bytes: base64Bytes(input.base64),
    purpose: input.purpose,
  });
  if (refusal) {
    const text = UPLOAD_REFUSAL_TEXT[refusal];
    throw new TRPCError({
      code: refusal === "too_large" ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST",
      message: withFix(text.message, text.fix),
    });
  }
  const buffer = Buffer.from(input.base64.replace(/^data:[^,]*,/, ""), "base64");
  if (buffer.length === 0) {
    const text = UPLOAD_REFUSAL_TEXT.empty;
    throw new TRPCError({ code: "BAD_REQUEST", message: withFix(text.message, text.fix) });
  }
  return { buffer, ext: safeUploadExtension(input.fileName) || "bin" };
}
