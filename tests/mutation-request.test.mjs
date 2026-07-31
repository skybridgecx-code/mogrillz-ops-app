import assert from "node:assert/strict";
import test from "node:test";

import { validateMutationRequest } from "../src/lib/http/mutation-request.ts";

function request(url, headers = {}) {
  return new Request(url, { method: "POST", headers });
}

test("accepts same-origin JSON browser mutations", () => {
  assert.deepEqual(
    validateMutationRequest(
      request("https://ops.example.com/api/menu", {
        origin: "https://ops.example.com",
        "sec-fetch-site": "same-origin",
        "content-type": "application/json; charset=utf-8",
      }),
      "json",
    ),
    { ok: true },
  );
});

test("rejects cross-origin and same-site-subdomain mutations", () => {
  assert.deepEqual(
    validateMutationRequest(
      request("https://ops.example.com/api/menu", {
        origin: "https://evil.example.com",
        "sec-fetch-site": "same-site",
        "content-type": "application/json",
      }),
      "json",
    ),
    { ok: false, reason: "cross-origin" },
  );

  assert.deepEqual(
    validateMutationRequest(
      request("https://ops.example.com/api/menu", {
        origin: "https://attacker.test",
        "sec-fetch-site": "cross-site",
        "content-type": "application/json",
      }),
      "json",
    ),
    { ok: false, reason: "cross-origin" },
  );
});

test("requires JSON instead of simple-request text content", () => {
  assert.deepEqual(
    validateMutationRequest(
      request("https://ops.example.com/api/menu", {
        origin: "https://ops.example.com",
        "sec-fetch-site": "same-origin",
        "content-type": "text/plain",
      }),
      "json",
    ),
    { ok: false, reason: "content-type" },
  );
});

test("requires a multipart boundary for image uploads", () => {
  assert.deepEqual(
    validateMutationRequest(
      request("https://ops.example.com/api/menu/item/image", {
        origin: "https://ops.example.com",
        "sec-fetch-site": "same-origin",
        "content-type": "multipart/form-data; boundary=abc123",
      }),
      "multipart",
    ),
    { ok: true },
  );

  assert.deepEqual(
    validateMutationRequest(
      request("https://ops.example.com/api/menu/item/image", {
        origin: "https://ops.example.com",
        "sec-fetch-site": "same-origin",
        "content-type": "multipart/form-data",
      }),
      "multipart",
    ),
    { ok: false, reason: "content-type" },
  );
});

test("allows trusted non-browser clients without browser origin headers", () => {
  assert.deepEqual(
    validateMutationRequest(
      request("https://ops.example.com/api/menu", {
        "content-type": "application/json",
      }),
      "json",
    ),
    { ok: true },
  );
});
