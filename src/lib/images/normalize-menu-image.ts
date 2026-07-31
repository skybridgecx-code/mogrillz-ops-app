import sharp from "sharp";

export const MENU_IMAGE_MAX_INPUT_PIXELS = 40_000_000;
export const MENU_IMAGE_MAX_OUTPUT_DIMENSION = 1600;
export const MENU_IMAGE_MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

export class InvalidMenuImageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidMenuImageError";
  }
}

export async function normalizeMenuImage(input: Uint8Array) {
  try {
    const metadata = await sharp(input, {
      failOn: "warning",
      limitInputPixels: MENU_IMAGE_MAX_INPUT_PIXELS,
    }).metadata();

    if (!metadata.width || !metadata.height) {
      throw new InvalidMenuImageError("Image dimensions are unavailable.");
    }

    const output = await sharp(input, {
      failOn: "warning",
      limitInputPixels: MENU_IMAGE_MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize({
        width: MENU_IMAGE_MAX_OUTPUT_DIMENSION,
        height: MENU_IMAGE_MAX_OUTPUT_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();

    if (!output.length || output.length > MENU_IMAGE_MAX_OUTPUT_BYTES) {
      throw new InvalidMenuImageError("Normalized image exceeds the storage limit.");
    }

    return output;
  } catch (error) {
    if (error instanceof InvalidMenuImageError) throw error;
    throw new InvalidMenuImageError("The file is not a valid supported image.", {
      cause: error,
    });
  }
}
