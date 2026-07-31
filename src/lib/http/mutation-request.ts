export type MutationContentType = "json" | "multipart";

export type MutationRequestValidation =
  | { ok: true }
  | { ok: false; reason: "cross-origin" | "content-type" | "invalid-url" };

function hasExpectedContentType(contentType: string, expected: MutationContentType) {
  const normalized = contentType.trim().toLowerCase();
  if (expected === "json") {
    return normalized === "application/json" || normalized.startsWith("application/json;");
  }

  return normalized.startsWith("multipart/form-data;") && normalized.includes("boundary=");
}

export function validateMutationRequest(
  request: Pick<Request, "url" | "headers">,
  expectedContentType: MutationContentType,
): MutationRequestValidation {
  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return { ok: false, reason: "invalid-url" };
  }

  const originHeader = request.headers.get("origin")?.trim();
  if (originHeader) {
    try {
      if (new URL(originHeader).origin !== requestOrigin) {
        return { ok: false, reason: "cross-origin" };
      }
    } catch {
      return { ok: false, reason: "cross-origin" };
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") {
    return { ok: false, reason: "cross-origin" };
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!hasExpectedContentType(contentType, expectedContentType)) {
    return { ok: false, reason: "content-type" };
  }

  return { ok: true };
}
