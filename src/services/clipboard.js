// Shared clipboard copy utility with button feedback

export async function copyTextWithButtonFeedback(text, btn, resetText = "Copy") {
  const prev = resetText || btn?.textContent || "Copy";
  try {
    await navigator.clipboard.writeText(text);
    if (btn) btn.textContent = "✓ Copied";
  } catch {
    if (btn) btn.textContent = "Copied";
  }
  if (btn) {
    setTimeout(() => {
      btn.textContent = prev;
    }, 1500);
  }
}
