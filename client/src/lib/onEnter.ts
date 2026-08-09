import type { KeyboardEvent } from "react";

/**
 * Enter submits.
 *
 * Three portal forms could only be sent by finding and tapping their button.
 * On a phone that means dismissing the keyboard first, and on the tracking
 * declaration — a form with one field in it — the keyboard's own go key sat
 * there doing nothing.
 *
 * Two things this has to get right:
 *
 * `isComposing` is the important one. A Chinese customer typing 中文 presses
 * Enter to choose a candidate from the IME, several times per word. Without
 * this check the first candidate they picked would submit the form and send a
 * half-typed tracking number. The same applies to any keyboard with a
 * candidate window, which is most of the ones used to type Chinese.
 *
 * Shift+Enter is left alone so it keeps meaning "new line" wherever a field
 * grows into a textarea later.
 *
 * `enterKeyHint` is worth setting alongside this at each call site: it is what
 * labels the phone's key "Go" or "Send" instead of a bare arrow, so the key
 * says what it now does.
 */
export function onEnter(submit: () => void) {
  return (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    // React's synthetic event carries the native flag; older Safari sets 229.
    if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
    if (e.keyCode === 229) return;
    e.preventDefault();
    submit();
  };
}
