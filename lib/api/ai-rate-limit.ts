import { checkRateLimit } from "@vercel/firewall";

type AiOperation = "image-generation" | "look-analysis";

const windowMs = 10 * 60 * 1000;
const policies: Record<AiOperation, { id: string; limit: number; message: string }> = {
  "image-generation": {
    id: "lumora-image-generation",
    limit: 3,
    message: "You've reached the limit for creating looks. Please try again in a few minutes.",
  },
  "look-analysis": {
    id: "lumora-look-analysis",
    limit: 10,
    message: "You've requested too many look analyses. Please try again in a few minutes.",
  },
};

const developmentBuckets = new Map<string, { count: number; resetAt: number }>();

function limitedResponse(message: string, retryAfterSeconds: number) {
  return Response.json(
    { error: { code: "RATE_LIMITED", message, retryAfterSeconds } },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" } },
  );
}

function unavailableResponse() {
  return Response.json(
    { error: { code: "RATE_LIMITER_UNAVAILABLE", message: "Lumora is temporarily unable to accept AI requests. Please try again shortly." } },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

function checkDevelopmentLimit(request: Request, operation: AiOperation): Response | null {
  const policy = policies[operation];
  const clientIp = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${operation}:${clientIp}`;
  const now = Date.now();
  const current = developmentBuckets.get(key);

  if (!current || current.resetAt <= now) {
    developmentBuckets.set(key, { count: 1, resetAt: now + windowMs });
  } else if (current.count >= policy.limit) {
    return limitedResponse(policy.message, Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
  } else {
    current.count += 1;
  }

  if (developmentBuckets.size > 2048) {
    for (const [bucketKey, bucket] of developmentBuckets) {
      if (bucket.resetAt <= now) developmentBuckets.delete(bucketKey);
    }
  }

  return null;
}

export async function enforceAiRateLimit(request: Request, operation: AiOperation): Promise<Response | null> {
  if (process.env.VERCEL !== "1") {
    if (process.env.NODE_ENV === "production") return unavailableResponse();
    return checkDevelopmentLimit(request, operation);
  }

  try {
    const result = await checkRateLimit(policies[operation].id, { request });
    if (result.error) return unavailableResponse();
    return result.rateLimited ? limitedResponse(policies[operation].message, 600) : null;
  } catch {
    return unavailableResponse();
  }
}