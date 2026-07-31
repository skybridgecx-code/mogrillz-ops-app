import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  InvalidMenuImageError,
  normalizeMenuImage,
} from "../src/lib/images/normalize-menu-image.ts";

test("normalizes a decoded image to bounded WebP output", async () => {
  const source = await sharp({
    create: {
      width: 2000,
      height: 1000,
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
    },
  })
    .png()
    .toBuffer();

  const output = await normalizeMenuImage(source);
  const metadata = await sharp(output).metadata();

  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 800);
  assert.ok(output.length > 0);
  assert.ok(output.length <= 5 * 1024 * 1024);
});

test("rejects content that is not a decodable image", async () => {
  await assert.rejects(
    () => normalizeMenuImage(Buffer.from("not-an-image")),
    (error) => error instanceof InvalidMenuImageError,
  );
});
