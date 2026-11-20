// Unified modal stack, Escape/backdrop close, focus restoration, body scroll lock, and accessible confirm/prompt dialogs

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function createModalManager({
  doc = typeof document !== "undefined" ? document : null,
  body = typeof document !== "undefined" ? document.body : null
} = {}) {
  const stack = [];
  let scrollLockCount = 0;

  function syncScrollLock(delta) {
    scrollLockCount = Math.max(0, scrollLockCount + delta);
    if (!body?.style) return;
    body.style.overflow = scrollLockCount > 0 ? "hidden" : "";
  }

  function isOpen(el) {
    return Boolean(el && !el.hidden && stack.some(entry => entry.el === el));
  }

  function hasOpenModal() {
    return stack.length > 0;
  }

  function getTopModal() {
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }

  function open(el, { onClose = null, closeOnBackdrop = true, lockScroll = true, initialFocus = null } = {}) {
    if (!el) return;
    if (isOpen(el)) return;

    const previousFocus = doc?.activeElement || null;
    el.hidden = false;

    const onBackdropClick = (e) => {
      if (closeOnBackdrop && e.target === el) {
        close(el);
      }
    };
    if (typeof el.addEventListener === "function") {
      el.addEventListener("click", onBackdropClick);
    }

    stack.push({ el, previousFocus, onClose, closeOnBackdrop, lockScroll, onBackdropClick });
    if (lockScroll) syncScrollLock(1);

    // Move focus inside dialog cleanly
    let focusTarget = initialFocus;
    if (!focusTarget && typeof el.querySelector === "function") {
      focusTarget = el.querySelector("[autofocus]") || el.querySelector(FOCUSABLE_SELECTOR) || el;
    }
    if (focusTarget && typeof focusTarget.focus === "function") {
      try { focusTarget.focus(); } catch {}
    }
  }

  function close(el) {
    if (!el) return false;
    const idx = stack.findIndex(entry => entry.el === el);
    const wasHidden = el.hidden;

    if (idx === -1) {
      if (!wasHidden) el.hidden = true;
      return false;
    }

    const [entry] = stack.splice(idx, 1);
    if (typeof el.removeEventListener === "function" && entry.onBackdropClick) {
      el.removeEventListener("click", entry.onBackdropClick);
    }
    el.hidden = true;
    if (entry.lockScroll) syncScrollLock(-1);
    if (typeof entry.onClose === "function") {
      try { entry.onClose(); } catch {}
    }
    if (entry.previousFocus && typeof entry.previousFocus.focus === "function") {
      try { entry.previousFocus.focus(); } catch {}
    }
    return true;
  }

  function closeTop() {
    const top = getTopModal();
    if (!top) return false;
    return close(top.el);
  }

  function handleKeyDown(e) {
    const top = getTopModal();
    if (!top) return false;

    if (e.key === "Escape") {
      e.preventDefault?.();
      close(top.el);
      return true;
    }

    if (e.key === "Tab" && typeof top.el.querySelectorAll === "function") {
      const focusables = Array.from(top.el.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter(node => node.offsetParent !== null || node === doc?.activeElement);
      if (focusables.length === 0) return true;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && doc?.activeElement === first) {
        e.preventDefault?.();
        last.focus?.();
      } else if (!e.shiftKey && doc?.activeElement === last) {
        e.preventDefault?.();
        first.focus?.();
      }
      return true;
    }

    return false;
  }

  function confirmDialog({
    title = "Confirm",
    message = "",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false
  } = {}) {
    if (!doc || !body) return Promise.resolve(false);
    return new Promise((resolve) => {
      const overlay = doc.createElement("div");
      overlay.className = "solve-modal-overlay app-dialog-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "appConfirmTitle");
      overlay.hidden = true;

      const card = doc.createElement("div");
      card.className = "solve-modal-card app-dialog-card";

      const head = doc.createElement("div");
      head.className = "solve-modal-header";
      const h2 = doc.createElement("h2");
      h2.id = "appConfirmTitle";
      h2.className = "solve-modal-title";
      h2.textContent = title;
      const closeX = doc.createElement("button");
      closeX.type = "button";
      closeX.className = "modal-close-btn";
      closeX.setAttribute("aria-label", "Close dialog");
      closeX.textContent = "×";
      head.append(h2, closeX);

      const content = doc.createElement("div");
      content.className = "solve-modal-content";
      const p = doc.createElement("p");
      p.className = "app-dialog-message";
      p.textContent = message;
      content.appendChild(p);

      const foot = doc.createElement("div");
      foot.className = "solve-modal-footer";
      const cancelBtn = doc.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn";
      cancelBtn.textContent = cancelLabel;
      const confirmBtn = doc.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = `btn ${danger ? "btn-danger-fill" : "btn-primary"}`;
      confirmBtn.textContent = confirmLabel;
      foot.append(cancelBtn, confirmBtn);

      card.append(head, content, foot);
      overlay.appendChild(card);
      body.appendChild(overlay);

      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        close(overlay);
        overlay.remove();
        resolve(val);
      };

      closeX.addEventListener("click", () => finish(false));
      cancelBtn.addEventListener("click", () => finish(false));
      confirmBtn.addEventListener("click", () => finish(true));

      open(overlay, {
        initialFocus: confirmBtn,
        onClose: () => {
          if (!settled) {
            settled = true;
            overlay.remove();
            resolve(false);
          }
        }
      });
    });
  }

  function promptDialog({
    title = "Input",
    message = "",
    placeholder = "",
    defaultValue = "",
    confirmLabel = "OK",
    cancelLabel = "Cancel",
    readOnly = false
  } = {}) {
    if (!doc || !body) return Promise.resolve(null);
    return new Promise((resolve) => {
      const overlay = doc.createElement("div");
      overlay.className = "solve-modal-overlay app-dialog-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "appPromptTitle");
      overlay.hidden = true;

      const card = doc.createElement("div");
      card.className = "solve-modal-card app-dialog-card";

      const head = doc.createElement("div");
      head.className = "solve-modal-header";
      const h2 = doc.createElement("h2");
      h2.id = "appPromptTitle";
      h2.className = "solve-modal-title";
      h2.textContent = title;
      const closeX = doc.createElement("button");
      closeX.type = "button";
      closeX.className = "modal-close-btn";
      closeX.setAttribute("aria-label", "Close dialog");
      closeX.textContent = "×";
      head.append(h2, closeX);

      const content = doc.createElement("div");
      content.className = "solve-modal-content";
      if (message) {
        const p = doc.createElement("p");
        p.className = "app-dialog-message";
        p.textContent = message;
        content.appendChild(p);
      }

      const input = readOnly ? doc.createElement("textarea") : doc.createElement("input");
      if (!readOnly) input.type = "text";
      else input.rows = 5;
      input.className = "session-form-input";
      input.value = defaultValue || "";
      if (placeholder) input.placeholder = placeholder;
      if (readOnly) input.readOnly = true;
      content.appendChild(input);

      const foot = doc.createElement("div");
      foot.className = "solve-modal-footer";
      const cancelBtn = doc.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn";
      cancelBtn.textContent = cancelLabel;
      const confirmBtn = doc.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "btn btn-primary";
      confirmBtn.textContent = confirmLabel;
      foot.append(cancelBtn, confirmBtn);

      card.append(head, content, foot);
      overlay.appendChild(card);
      body.appendChild(overlay);

      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        close(overlay);
        overlay.remove();
        resolve(val);
      };

      closeX.addEventListener("click", () => finish(null));
      cancelBtn.addEventListener("click", () => finish(null));
      confirmBtn.addEventListener("click", () => finish(input.value));
      input.addEventListener("keydown", (e) => {
        if (!readOnly && e.key === "Enter") {
          e.preventDefault();
          finish(input.value);
        }
      });

      open(overlay, {
        initialFocus: input,
        onClose: () => {
          if (!settled) {
            settled = true;
            overlay.remove();
            resolve(null);
          }
        }
      });
      if (typeof input.select === "function") {
        try { input.select(); } catch {}
      }
    });
  }

  return {
    open,
    close,
    closeTop,
    isOpen,
    hasOpenModal,
    getTopModal,
    getScrollLockCount: () => scrollLockCount,
    handleKeyDown,
    confirmDialog,
    promptDialog
  };
}

export const modalManager = createModalManager();
