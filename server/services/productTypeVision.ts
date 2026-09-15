import { invokeLLM } from "../_core/llm";
import { appLogger } from "../utils/logger";

/**
 * Look at the product photo and say which of THIS office's product types it
 * is — the owner's ask (Sep 2026): «کاتێ من وێنەم دانا سیستەم بە خۆی بزانێ
 * جۆرەکەی چیە».
 *
 * Deliberately separate from `analyzePackageImage` in ai.service.ts, which
 * classifies into a fixed built-in list of parcel categories. The dropdown
 * on the order forms is filled from `productAttributes` — the office edits
 * that list in settings — so the list is passed IN, and the model is told to
 * answer with one of those exact strings or with nothing.
 *
 * A confident answer naming a type that does not exist would be worse than
 * no answer: it cannot be selected, and the operator is left wondering what
 * the machine meant. So the reply is matched back against the list and
 * dropped if it is not there.
 *
 * The product name, when one has been typed, goes along as a second signal.
 * A photo of a small black box is ambiguous; the same photo beside the words
 * "Bluetooth speaker" is not.
 *
 * Never throws. This sits next to a dropdown that works perfectly well by
 * hand, so a missing API key, a slow model and a refusal must all end the
 * same way: no suggestion, no noise, no blocked form.
 */

export interface ProductTypeGuess {
  /** One of the options passed in, or null when there is no confident match. */
  type: string | null;
  /** 0-100, as the model reported it. 0 whenever `type` is null. */
  confidence: number;
}

const NO_GUESS: ProductTypeGuess = { type: null, confidence: 0 };

export async function classifyProductType(
  imageUrl: string,
  options: string[],
  hint?: string,
): Promise<ProductTypeGuess> {
  const choices = options.map((o) => o.trim()).filter(Boolean);
  if (!imageUrl || choices.length === 0) return NO_GUESS;

  const allowed = choices.map((c) => "- " + c).join("\n");
  const system = [
    "You classify a product photo into exactly one of the categories a shipping office uses.",
    "",
    "The ONLY allowed answers are these, copied character for character:",
    allowed,
    "",
    "Rules:",
    "- Answer with one of the strings above, exactly as written, or with an empty string.",
    "- An empty string is the right answer when the photo is unclear, shows a plain carton or a shipping label, or fits none of the categories.",
    "- Abstaining is better than guessing: a wrong category is saved onto a real order without anyone reading it again.",
    "- confidence is 0-100 and must say how sure you are that THIS photo shows THAT category.",
  ].join("\n");

  const question = hint && hint.trim()
    ? 'Which category is this product? The operator typed this name for it: "' + hint.trim() + '"'
    : "Which category is this product?";

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: question },
            // "low" detail on purpose: naming a shoe a shoe does not need a
            // high-resolution read, and this runs every time a photo is
            // dropped onto a form.
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "product_type",
          strict: true,
          schema: {
            type: "object",
            properties: {
              type: { type: "string", description: "One of the allowed categories, or an empty string" },
              confidence: { type: "number", description: "0-100" },
            },
            required: ["type", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") return NO_GUESS;

    const parsed = JSON.parse(content) as { type?: unknown; confidence?: unknown };
    const answer = String(parsed.type ?? "").trim();
    if (!answer) return NO_GUESS;

    // The answer has to BE one of the options. Matched case-insensitively,
    // then returned in the list's own spelling, so what lands in the field is
    // the row the dropdown actually holds.
    const match = choices.find((c) => c.toLowerCase() === answer.toLowerCase());
    if (!match) {
      appLogger.info("[AI] product type suggestion discarded — not one of the office's own types", { answer });
      return NO_GUESS;
    }

    const confidence = Number(parsed.confidence);
    return { type: match, confidence: Number.isFinite(confidence) ? confidence : 0 };
  } catch (error) {
    appLogger.warn("[AI] product type classification unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NO_GUESS;
  }
}
