/**
 * Hand over a PDF the server made. A report comes back inside the answer as a
 * data URL, which browsers refuse to open in a new tab, so it is saved as a
 * file instead - which is also what its button says.
 */
export function openPdf(url: string): void {
  if (!url.startsWith("data:")) {
    window.open(url, "_blank");
    return;
  }
  const bytes = Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (c) => c.charCodeAt(0));
  const file = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = file;
  a.download = "wazn-report.pdf";
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(file), 60_000);
}
