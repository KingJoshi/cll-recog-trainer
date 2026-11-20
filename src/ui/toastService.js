// Non-blocking toast notification service (Node-safe)

const DEFAULT_DURATION_MS = 3200;

function ensureToastContainer() {
  if (typeof document === "undefined") return null;
  let container = document.getElementById("toastContainer");
  if (!container && document.body) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = "info", durationMs = DEFAULT_DURATION_MS) {
  if (!message) return null;
  const container = ensureToastContainer();
  if (!container) return null;

  const toast = document.createElement("div");
  toast.className = `toast-item toast-${type}`;

  const icon = type === "error"
    ? "⚠"
    : type === "warning"
      ? "!"
      : type === "success"
        ? "✓"
        : "ℹ";

  const iconSpan = document.createElement("span");
  iconSpan.className = "toast-icon";
  iconSpan.setAttribute("aria-hidden", "true");
  iconSpan.textContent = icon;

  const msgSpan = document.createElement("span");
  msgSpan.className = "toast-message";
  msgSpan.textContent = String(message);

  const dismissBtn = document.createElement("button");
  dismissBtn.type = "button";
  dismissBtn.className = "toast-dismiss";
  dismissBtn.setAttribute("aria-label", "Dismiss notification");
  dismissBtn.textContent = "×";

  const dismiss = () => {
    toast.classList.add("toast-leaving");
    setTimeout(() => toast.remove(), 180);
  };
  dismissBtn.addEventListener("click", dismiss);

  toast.append(iconSpan, msgSpan, dismissBtn);
  container.appendChild(toast);

  if (durationMs > 0) {
    setTimeout(() => {
      if (toast.isConnected) dismiss();
    }, durationMs);
  }

  return toast;
}
