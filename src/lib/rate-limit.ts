import { NextRequest, NextResponse } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic cleanup of stale rate-limit entries every 5 minutes
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

/**
 * Extracts client IP safely from request headers.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

/**
 * Checks in-memory rate limit for a given endpoint and client IP.
 * @param req NextRequest
 * @param limit Maximum allowed requests in window
 * @param windowMs Window duration in milliseconds (default: 60 seconds)
 * @returns { allowed: boolean, remaining: number, resetMs: number }
 */
export function checkRateLimit(
  req: NextRequest,
  limit = 20,
  windowMs = 60 * 1000
): { allowed: boolean; remaining: number; resetMs: number } {
  const ip = getClientIp(req);
  const path = req.nextUrl.pathname;
  const key = `${ip}:${path}`;
  const now = Date.now();

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetMs: windowMs,
    };
  }

  record.count += 1;

  if (record.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, record.resetAt - now),
    };
  }

  return {
    allowed: true,
    remaining: limit - record.count,
    resetMs: Math.max(0, record.resetAt - now),
  };
}

/**
 * Helper to return a 429 Too Many Requests response with appropriate headers.
 */
export function rateLimitExceededResponse(resetMs: number) {
  const retryAfterSeconds = Math.ceil(resetMs / 1000) || 1;
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}
