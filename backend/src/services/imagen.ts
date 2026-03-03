import { createLogger } from "../utils/logger.js";

const log = createLogger("imagen");

export interface ImagenOptions {
  aspectRatio?: "16:9" | "1:1" | "9:16" | "4:3" | "3:4";
  model?: string;
}

/**
 * Generate an image via Google Imagen 4 API and return the raw buffer.
 * Costs ~$0.02 per image.
 */
export async function generateImageBuffer(
  prompt: string,
  options: ImagenOptions = {},
): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const model = options.model ?? process.env.IMAGEN_MODEL ?? "imagen-4.0-fast-generate-001";
  const aspectRatio = options.aspectRatio ?? "16:9";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`;

  log.info({ model, aspectRatio, promptLength: prompt.length }, "generating image");

  const response = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio, personGeneration: "allow_adult" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imagen API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    predictions?: Array<{ bytesBase64Encoded: string }>;
  };

  if (!data.predictions?.[0]?.bytesBase64Encoded) {
    throw new Error("No image data in Imagen API response");
  }

  const buffer = Buffer.from(data.predictions[0].bytesBase64Encoded, "base64");
  log.info({ sizeKb: Math.round(buffer.length / 1024) }, "image generated");
  return buffer;
}
