// Delegated contextual tooltip controller (desktop hover + keyboard focus + click-to-toggle `.info-tip-btn`)

const VIEWPORT_MARGIN = 8;

/**
 * Pure viewport-clamped positioning helper (Node-testable).
 * Places the tooltip below the trigger by default, flipping above if near the bottom edge.
 */
export function computeTooltipPosition(triggerRect, tipRect, viewport, gap = 8) {
  const vw = Math.max(120, Number(viewport?.width) || 320);
  const vh = Math.max(120, Number(viewport?.height) || 320);
  const tw = Math.min(Number(tipRect?.width) || 180, vw - VIEWPORT_MARGIN * 2);
  const th = Number(tipRect?.height) || 36;

  const centeredLeft = (triggerRect?.left || 0) + ((triggerRect?.width || 0) - tw) / 2;
  const maxLeft = Math.max(VIEWPORT_MARGIN, vw - tw - VIEWPORT_MARGIN);
  const left = Math.round(Math.max(VIEWPORT_MARGIN, Math.min(maxLeft, centeredLeft)));

  const bottomSpace = vh - (triggerRect?.bottom || 0) - VIEWPORT_MARGIN;
  const topSpace = (triggerRect?.top || 0) - VIEWPORT_MARGIN;
  const fitsBelow = (gap + th) <= bottomSpace;
  const fitsAbove = (gap + th) <= topSpace;

  let placement = "bottom";
  let rawTop = (triggerRect?.bottom || 0) + gap;
  if (!fitsBelow && fitsAbove) {
    placement = "top";
    rawTop = (triggerRect?.top || 0) - gap - th;
  } else if (!fitsBelow && !fitsAbove && topSpace > bottomSpace) {
    placement = "top";
    rawTop = VIEWPORT_MARGIN;
  }

  const maxTop = Math.max(VIEWPORT_MARGIN, vh - th - VIEWPORT_MARGIN);
  const top = Math.round(Math.max(VIEWPORT_MARGIN, Math.min(maxTop, rawTop)));

  return { left, top, placement };
}

/**
 * Mount delegated hover/focus/click tooltips for any element with `[data-tooltip]`.
 */
export function createTooltipController({ isEnabled = () => true } = {}) {
  if (typeof document === "undefined" || !document.body) {
    return {
      hide() {},
      destroy() {}
    };
  }

  let tipEl = document.getElementById("appTooltip");
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.id = "appTooltip";
    tipEl.className = "app-tooltip";
    tipEl.setAttribute("role", "tooltip");
    tipEl.hidden = true;
    document.body.appendChild(tipEl);
  }

  let activeTarget = null;
  let showTimer = 0;

  function clearPendingTimer() {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = 0;
    }
  }

  function hide() {
    clearPendingTimer();
    if (activeTarget) {
      activeTarget.removeAttribute("aria-describedby");
      activeTarget = null;
    }
    tipEl.classList.remove("visible");
    tipEl.hidden = true;
    tipEl.textContent = "";
  }

  function showFor(target) {
    if (!target || !isEnabled() || !target.isConnected) {
      hide();
      return;
    }
    const text = target.getAttribute("data-tooltip")?.trim();
    if (!text) {
      hide();
      return;
    }

    if (activeTarget && activeTarget !== target) {
      activeTarget.removeAttribute("aria-describedby");
    }
    activeTarget = target;
    target.setAttribute("aria-describedby", tipEl.id);

    tipEl.textContent = text;
    tipEl.hidden = false;
    tipEl.classList.remove("visible");
    tipEl.style.left = "0px";
    tipEl.style.top = "0px";

    const triggerRect = target.getBoundingClientRect();
    const tipRect = tipEl.getBoundingClientRect();
    const pos = computeTooltipPosition(triggerRect, tipRect, {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight
    });

    tipEl.style.left = `${pos.left}px`;
    tipEl.style.top = `${pos.top}px`;
    tipEl.dataset.placement = pos.placement;
    tipEl.classList.add("visible");
  }

  function onMouseOver(e) {
    if (!isEnabled()) return;
    const trigger = e.target?.closest?.("[data-tooltip]");
    if (!trigger) return;
    if (activeTarget === trigger) return;
    clearPendingTimer();
    showTimer = setTimeout(() => {
      showTimer = 0;
      showFor(trigger);
    }, 300);
  }

  function onMouseOut(e) {
    const trigger = e.target?.closest?.("[data-tooltip]");
    if (!trigger) return;
    const next = e.relatedTarget?.closest?.("[data-tooltip]");
    if (next === trigger) return;
    hide();
  }

  function onFocusIn(e) {
    if (!isEnabled()) return;
    const trigger = e.target?.closest?.("[data-tooltip]");
    if (!trigger) return;
    const isKeyboardFocus = typeof trigger.matches === "function"
      ? (trigger.matches(":focus-visible") || trigger.classList.contains("info-tip-btn"))
      : true;
    if (!isKeyboardFocus) return;
    clearPendingTimer();
    showFor(trigger);
  }

  function onFocusOut(e) {
    const trigger = e.target?.closest?.("[data-tooltip]");
    if (trigger && trigger === activeTarget) {
      hide();
    }
  }

  function onClick(e) {
    const infoBtn = e.target?.closest?.(".info-tip-btn[data-tooltip]");
    if (infoBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (!isEnabled()) return;
      if (activeTarget === infoBtn && !tipEl.hidden) {
        hide();
      } else {
        clearPendingTimer();
        showFor(infoBtn);
      }
      return;
    }
    if (activeTarget) hide();
  }

  function onPointerDown(e) {
    if (e.target?.closest?.(".info-tip-btn[data-tooltip]")) return;
    if (activeTarget || showTimer) hide();
  }

  function onKeyDown(e) {
    if (e.key === "Escape" && activeTarget) {
      hide();
    }
  }

  function onViewportChange() {
    if (activeTarget || showTimer) hide();
  }

  document.addEventListener("mouseover", onMouseOver);
  document.addEventListener("mouseout", onMouseOut);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("click", onClick);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("scroll", onViewportChange, { passive: true, capture: true });
  window.addEventListener("resize", onViewportChange, { passive: true });

  return {
    hide,
    destroy() {
      hide();
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("click", onClick);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    }
  };
}
