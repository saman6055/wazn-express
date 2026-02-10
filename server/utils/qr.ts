import * as crypto from "crypto";
import { getConfig } from "../config";

export function signQrData(data: string): string {
  const secret = getConfig().jwtSecret;
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export function verifyQrSignature(data: string, signature: string): boolean {
  const expectedSignature = signQrData(data);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
