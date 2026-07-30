import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * A toast must always be readable at a glance.
 *
 * Some failures carry a serialized payload in their message — a base64 product
 * image plus every field of the order — and printing that verbatim turned the
 * toast into a full-height wall of characters covering the page, with no hint
 * of what actually went wrong. Call sites sanitize what they can, but this is
 * the backstop: no toast, from anywhere, may grow past a few lines.
 *
 * The text is clamped rather than cut in code so a genuinely long-but-useful
 * message is still fully present for copy/paste and for screen readers.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "max-h-40 overflow-hidden",
          // Wrap unbroken strings (base64, long ids) instead of letting them
          // stretch the toast, and cap the visible text at six lines.
          title: "line-clamp-2 break-words [overflow-wrap:anywhere]",
          description: "line-clamp-4 break-words [overflow-wrap:anywhere]",
        },
        ...props.toastOptions,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
