import { z } from "zod";

export const phoneSchema = z.string().regex(/^[+]?[\d\s-]{7,20}$/).max(20);
export const emailSchema = z.string().email().max(255);
export const idSchema = z.number().int().positive();
export const amountSchema = z.number().min(0).max(999999999);
export const packageCodeSchema = z.string().regex(/^WZN-[A-Z]+-\d+$/).max(50);
export const batchCodeSchema = z.string().regex(/^(SEA|AIR)-\d+$/).max(20);
