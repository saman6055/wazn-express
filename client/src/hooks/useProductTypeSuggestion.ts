import { useCallback, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

/**
 * "You put a photo in — I'll fill in what it is."
 *
 * The owner's ask (Sep 2026). A shipping office types the same dozen
 * categories all day, and the photo already says which one it is.
 *
 * Three deliberate limits, because a field that fills itself wrongly is
 * worse than one that stays empty:
 *
 *  • it only ever fills a field that is EMPTY — a choice somebody made by
 *    hand is never overwritten, however sure the model claims to be;
 *  • it only fills above `MIN_CONFIDENCE`, and an unsure model is told to
 *    abstain rather than guess, because a wrong category is saved onto a
 *    real order without anyone reading it again;
 *  • what it filled is marked on screen until the operator touches the
 *    field, so a guess is never mistaken for a decision.
 *
 * It never blocks anything. No API key, a slow model, a refusal — all end
 * the same way: the dropdown stays empty and is used by hand, as always.
 */

/** Below this, the suggestion is dropped without a word. */
export const MIN_CONFIDENCE = 60;

export function useProductTypeSuggestion() {
  /** True while a photo is being looked at — for a small spinner. */
  const [suggesting, setSuggesting] = useState(false);
  /** Set once the field was filled by the model; cleared when a human edits it. */
  const [wasSuggested, setWasSuggested] = useState(false);
  /** One photo is asked about once, however many times the form re-renders. */
  const asked = useRef<string | null>(null);

  const suggestMutation = trpc.productAttributes.suggestType.useMutation();

  /**
   * @param imageUrl  the photo as the form holds it (a data URI is fine)
   * @param current   what the field holds right now — a non-empty value wins
   * @param apply     called with the guess, only when it is worth applying
   * @param hint      the description, when one has been typed
   */
  const suggest = useCallback(
    async (imageUrl: string, current: string, apply: (value: string) => void, hint?: string) => {
      if (!imageUrl || current.trim()) return;
      if (asked.current === imageUrl) return;
      asked.current = imageUrl;

      setSuggesting(true);
      try {
        const result = await suggestMutation.mutateAsync({ imageUrl, hint: hint?.slice(0, 300) });
        if (result?.type && result.confidence >= MIN_CONFIDENCE) {
          apply(result.type);
          setWasSuggested(true);
        }
      } catch {
        // Silent on purpose: this is an accelerator, and an office that has
        // no AI key configured must not get an error toast on every photo.
      } finally {
        setSuggesting(false);
      }
    },
    [suggestMutation],
  );

  /** Call when the operator picks a type themselves, or the form resets. */
  const clearSuggestionMark = useCallback(() => setWasSuggested(false), []);

  /** Call on reset so the next order's first photo is asked about again. */
  const forgetAskedPhoto = useCallback(() => {
    asked.current = null;
    setWasSuggested(false);
  }, []);

  return { suggesting, wasSuggested, suggest, clearSuggestionMark, forgetAskedPhoto };
}
