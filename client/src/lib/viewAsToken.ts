/**
 * Where a tab keeps the look it was opened with (shared/viewAsCustomer).
 *
 * Its own file, not a line in main.tsx: a component that imports the app's
 * entry asks the dev server to run the entry a second time, which mounts the
 * whole app twice into one root - seen 2026-10-09 as an error panel on the
 * first portal page that drew the look's banner.
 */
export const VIEW_AS_TOKEN_KEY = "wazn-view-as";
