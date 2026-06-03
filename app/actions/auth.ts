"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export async function loginAction(
  email: string,
  password: string,
): Promise<{ error?: string; retryAfter?: number }> {
  const normalizedEmail = email.toLowerCase().trim();
  const ip = await getClientIp();

  // Email-based rate limit: 5 attempts per 15 min
  const emailLimit = checkRateLimit(`login:${normalizedEmail}`, 5);
  if (!emailLimit.allowed) {
    const minutes = Math.ceil((emailLimit.retryAfter ?? 0) / 60);
    return {
      error: `Too many login attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      retryAfter: emailLimit.retryAfter,
    };
  }

  // IP-based rate limit: 10 attempts per 15 min
  const ipLimit = checkRateLimit(`login-ip:${ip}`, 10);
  if (!ipLimit.allowed) {
    const minutes = Math.ceil((ipLimit.retryAfter ?? 0) / 60);
    return {
      error: `Too many login attempts from your network. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      retryAfter: ipLimit.retryAfter,
    };
  }

  const sb = await createSupabaseServer();
  const { error } = await sb.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}
