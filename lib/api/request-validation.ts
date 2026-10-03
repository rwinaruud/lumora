export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415,
    readonly code: "INVALID_REQUEST" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE",
  ) {
    super(message);
  }
}

export const maxImageDataUrlLength = 5_000_000;

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiRequestError("Send this request as JSON.", 415, "UNSUPPORTED_MEDIA_TYPE");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiRequestError("The request is too large. Choose smaller images and try again.", 413, "PAYLOAD_TOO_LARGE");
  }
  if (!request.body) throw new ApiRequestError("A JSON request body is required.", 400, "INVALID_REQUEST");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ApiRequestError("The request is too large. Choose smaller images and try again.", 413, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError("The request body could not be read.", 400, "INVALID_REQUEST");
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new ApiRequestError("The request body must contain valid JSON.", 400, "INVALID_REQUEST");
  }
}

function matchesImageSignature(mediaType: string, bytes: Buffer): boolean {
  if (mediaType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mediaType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mediaType === "image/gif") return bytes.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/) !== null;
  if (mediaType === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export function validateImageDataUrl(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length > maxImageDataUrlLength) {
    throw new ApiRequestError(`${label} must be a supported image under 5 MB.`, 400, "INVALID_REQUEST");
  }

  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new ApiRequestError(`${label} must be a JPEG, PNG, WebP, or GIF image.`, 400, "INVALID_REQUEST");

  const [, mediaType, encoded] = match;
  const bytes = Buffer.from(encoded, "base64");
  if (!encoded.length || encoded.length % 4 !== 0 || bytes.toString("base64") !== encoded || !matchesImageSignature(mediaType, bytes)) {
    throw new ApiRequestError(`${label} is not a valid ${mediaType.replace("image/", "").toUpperCase()} image.`, 400, "INVALID_REQUEST");
  }

  return value;
}

export function requestErrorResponse(error: ApiRequestError): Response {
  return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers: { "Cache-Control": "no-store" } });
}