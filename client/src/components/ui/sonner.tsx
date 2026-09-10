import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "@/contexts/LanguageContext";

/**
 * A toast must always be readable at a glance, and never sit on a control.
 *
 * Some failures carry a serialized payload in their message — a base64 product
 * image plus every field of the order — and printing that verbatim turned the
 * toast into a full-height wall of characters covering the page, with no hint
 * of what actually went wrong. Call sites sanitize what they can, but this is
 * the backstop: no toast, from anywhere, may grow past a few lines.
 *
 * The standard, in one place:
 * - Theme from the app's own ThemeContext. It used next-themes, which has no
 *   provider here, so toasts followed the operating system instead of the app
 *   and a dark app on a light OS printed grey text on grey.
 * - Coloured by kind (green success, red error, amber warning) with a close
 *   button, so a toast is read by its colour before its words.
 * - Lifted off the bottom edge and, in right-to-left pages, clear of the
 *   80px sidebar on the right: the corner held the tips button, the full-screen
 *   controls and the sidebar's last items, and toasts sat on top of them.
 * - Line breaks in a message are kept, and the text is clamped rather than cut
 *   in code, so a long-but-useful message is still whole for copy/paste.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();
  const { direction, isRTL } = useTranslation();

  return (
    <Sonner
      theme={theme}
      dir={direction}
      position="bottom-right"
      offset={{ bottom: 80, right: isRTL ? 96 : 24 }}
      mobileOffset={{ bottom: 72 }}
      duration={4000}
      visibleToasts={3}
      richColors
      closeButton
      className="toaster group print:hidden"
      toastOptions={{
        classNames: {
          toast: "max-h-48 overflow-hidden",
          // Wrap unbroken strings (base64, long ids) instead of letting them
          // stretch the toast, keep the message's own line breaks, and cap the
          // visible text at seven lines.
          title: "line-clamp-3 whitespace-pre-line break-words [overflow-wrap:anywhere]",
          description: "line-clamp-4 whitespace-pre-line break-words [overflow-wrap:anywhere]",
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
