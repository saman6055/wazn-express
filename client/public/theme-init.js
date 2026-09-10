/*
 * Put the saved theme on <html> before the first paint.
 *
 * Without this the page paints light, then flips to dark the moment React
 * mounts, and the boot screen cannot know which colours to use.
 *
 * A file, not an inline <script>: the production security policy runs
 * scripts from this site only, so the inline version never ran there, and
 * every dark-theme visit painted light first.
 */
try {
  if (localStorage.getItem("theme") === "dark") document.documentElement.classList.add("dark");
} catch (e) {
  /* private mode: light is a fine default */
}
