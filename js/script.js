"use strict";

let particlesInitModulePromise = null;
// Load the particles bootstrap module only when Glide mode needs it.
const loadParticlesInit = async () => {
  if (!particlesInitModulePromise) {
    particlesInitModulePromise = import('./particles.init.js')
      .catch((error) => {
        particlesInitModulePromise = null;
        throw error;
      });
  }
  return particlesInitModulePromise;
};

let particlesPresetFetchPath = '';
let particlesPresetFetchPromise = null;
// Reuse one preset request to avoid duplicate network and parse work.
const preloadParticlesPreset = (presetPath) => {
  if (particlesPresetFetchPromise && particlesPresetFetchPath === presetPath) {
    return particlesPresetFetchPromise;
  }

  if (typeof fetch !== 'function') return Promise.resolve(null);

  particlesPresetFetchPath = presetPath;
  particlesPresetFetchPromise = fetch(presetPath, { credentials: 'same-origin' })
    .then((response) => {
      if (!response.ok) throw new Error('Preset load failed');
      return response.json();
    })
    .catch((error) => {
      if (particlesPresetFetchPath === presetPath) {
        particlesPresetFetchPath = '';
        particlesPresetFetchPromise = null;
      }
      throw error;
    });

  return particlesPresetFetchPromise;
};

// Main runtime bootstrap for mode switching, navigation, cards, and overlays.
document.addEventListener('DOMContentLoaded', () => {
  const modeToggle = document.getElementById('modeToggle');
  const modeToggleStatus = document.querySelector('[data-mode-toggle-status]');
  const isLanding = document.body?.dataset?.assetScope === 'landing';
  const particlesControls = Array.from(document.querySelectorAll('[data-particles-control]'));
  const particlesToggleInputs = Array.from(document.querySelectorAll('[data-particles-toggle]'));
  const particlesStatusNodes = Array.from(document.querySelectorAll('[data-particles-status]'));

  const normaliseKey = (value) => String(value || '').trim().toLowerCase();
  const addImageVariantSuffix = (url, suffix) => String(url || '').replace(/(\.avif)(?=($|[?#]))/i, `${suffix}$1`);

  let particlesEngine = null;
  let particlesPresetPath = '';
  let particlesVisibilityBound = false;
  let particlesBootToken = 0;
  let particlesBootDelayTimer = 0;
  let particlesBootPaintFrame = 0;
  let particlesIdleHandle = 0;
  let particlesEnabled = true;
  const PARTICLES_INTENSITY_MIN = 250;
  const PARTICLES_INTENSITY_MAX = 2500;
  const PARTICLES_INTENSITY_STEP = 50;
  const PARTICLES_INTENSITY_DEFAULT = 1500;
  let particlesIntensity = PARTICLES_INTENSITY_DEFAULT;
  let syncSettingsMenuControls = () => {};
  let closeSettingsPanels = () => {};

  const clampParticlesIntensity = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return PARTICLES_INTENSITY_DEFAULT;
    const stepped = Math.round(parsed / PARTICLES_INTENSITY_STEP) * PARTICLES_INTENSITY_STEP;
    return Math.min(PARTICLES_INTENSITY_MAX, Math.max(PARTICLES_INTENSITY_MIN, stepped));
  };

  const getPresetPath = () => {
    const scriptNode = document.querySelector('script[type="module"][src$="js/script.js"]');
    const scriptHref = scriptNode?.src;
    if (scriptHref) return new URL('../presets/hero_Intro_glide.json', scriptHref).href;

    const presetPath = isLanding ? 'presets/hero_Intro_glide.json' : '../presets/hero_Intro_glide.json';
    return new URL(presetPath, document.baseURI).href;
  };
  const pageIsVisible = () => !document.hidden && document.visibilityState === 'visible';
  const glideIsActive = () => document.body?.dataset?.mode === 'glide';
  const isMobileViewport = () => window.matchMedia('(max-width: 900px)').matches;
  const supportsParticlesBoot = () => particlesEnabled;

  const cancelScheduledParticlesBoot = () => {
    if (particlesBootDelayTimer) {
      window.clearTimeout(particlesBootDelayTimer);
      particlesBootDelayTimer = 0;
    }
    if (particlesBootPaintFrame) {
      window.cancelAnimationFrame(particlesBootPaintFrame);
      particlesBootPaintFrame = 0;
    }
    if (particlesIdleHandle) {
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(particlesIdleHandle);
      } else {
        window.clearTimeout(particlesIdleHandle);
      }
      particlesIdleHandle = 0;
    }
  };

  const scheduleParticlesBoot = () => {
    cancelScheduledParticlesBoot();
    const boot = () => {
      particlesIdleHandle = 0;
      if (!glideIsActive() || !supportsParticlesBoot()) return;
      ensureGlideParticles();
    };

    const queueIdleBoot = () => {
      particlesBootDelayTimer = 0;

      if (typeof window.requestIdleCallback === 'function') {
        particlesIdleHandle = window.requestIdleCallback(boot, { timeout: 1200 });
        return;
      }

      particlesIdleHandle = window.setTimeout(boot, 420);
    };

    const queueBootAfterPaint = () => {
      const bootDelayMs = isMobileViewport() ? 220 : 140;
      if (isMobileViewport() && typeof window.requestAnimationFrame === 'function') {
        particlesBootPaintFrame = window.requestAnimationFrame(() => {
          particlesBootPaintFrame = 0;
          particlesBootDelayTimer = window.setTimeout(queueIdleBoot, bootDelayMs);
        });
        return;
      }

      particlesBootDelayTimer = window.setTimeout(queueIdleBoot, bootDelayMs);
    };

    if (document.readyState === 'complete') {
      queueBootAfterPaint();
      return;
    }

    window.addEventListener(
      'load',
      () => {
        queueBootAfterPaint();
      },
      { once: true },
    );
  };

  const stopGlideParticles = () => {
    particlesBootToken += 1;
    cancelScheduledParticlesBoot();
    if (particlesEngine) particlesEngine.destroy();
    particlesEngine = null;
    particlesPresetPath = '';
  };

  const ensureGlideParticles = () => {
    if (!pageIsVisible() || !supportsParticlesBoot()) return;

    const presetPath = getPresetPath();
    if (particlesEngine && particlesPresetPath === presetPath) return;

    stopGlideParticles();
    particlesPresetPath = presetPath;
    const bootToken = particlesBootToken;
    const presetPromise = preloadParticlesPreset(presetPath).catch(() => null);

    Promise.all([loadParticlesInit(), presetPromise])
      .then(([{ initParticleForge }, preset]) => {
        if (bootToken !== particlesBootToken || !glideIsActive() || !pageIsVisible()) return null;
        const intensitySmallCount = Math.max(
          PARTICLES_INTENSITY_MIN,
          Math.round(particlesIntensity * 0.8),
        );
        let presetWithIntensity = preset;
        if (preset && typeof preset === 'object') {
          presetWithIntensity = {
            ...preset,
            particleCount: particlesIntensity,
            particleCountLarge: particlesIntensity,
            particleCountSmall: intensitySmallCount,
          };
        }
        return initParticleForge({
          hostSelector: '#particles-layer',
          presetPath,
          preset: presetWithIntensity,
        });
      })
      .then((engine) => {
        if (bootToken !== particlesBootToken || !glideIsActive()) {
          if (engine && typeof engine.destroy === 'function') engine.destroy();
          return;
        }

        particlesEngine = engine || null;
        if (!particlesEngine) particlesPresetPath = '';
        if (particlesEngine && !pageIsVisible()) particlesEngine.pause?.();
      })
      .catch(() => {
        if (bootToken !== particlesBootToken) return;
        particlesEngine = null;
        particlesPresetPath = '';
      });
  };

  const syncGlideParticlesVisibility = () => {
    if (!particlesEnabled) {
      stopGlideParticles();
      return;
    }

    if (!glideIsActive()) {
      stopGlideParticles();
      return;
    }

    if (!pageIsVisible()) {
      particlesEngine?.pause?.();
      return;
    }

    if (!particlesEngine) {
      ensureGlideParticles();
      return;
    }

    particlesEngine.resume?.();
  };

  const bindParticlesVisibilityLifecycle = () => {
    if (particlesVisibilityBound) return;
    particlesVisibilityBound = true;

    const onVisibilityStateChange = () => {
      syncGlideParticlesVisibility();
    };

    document.addEventListener('visibilitychange', onVisibilityStateChange);
    window.addEventListener('focus', onVisibilityStateChange);
    window.addEventListener('blur', onVisibilityStateChange);
    window.addEventListener('pagehide', onVisibilityStateChange);
    window.addEventListener('pageshow', onVisibilityStateChange);
  };

  const readStoredParticlesPreference = () => {
    try {
      const value = localStorage.getItem('particlesEnabled');
      if (value === '0' || value === 'off' || value === 'false') return false;
      if (value === '1' || value === 'on' || value === 'true') return true;
    } catch (_error) {
      return true;
    }
    return true;
  };

  const readStoredParticlesIntensity = () => {
    try {
      const value = localStorage.getItem('particlesIntensity');
      if (value == null) return PARTICLES_INTENSITY_DEFAULT;
      return clampParticlesIntensity(value);
    } catch (_error) {
      return PARTICLES_INTENSITY_DEFAULT;
    }
  };

  const storeParticlesPreference = (enabled) => {
    try {
      localStorage.setItem('particlesEnabled', enabled ? '1' : '0');
    } catch (_error) {
      // Ignore storage errors in private mode or blocked storage contexts.
    }
  };

  const storeParticlesIntensity = (value) => {
    try {
      localStorage.setItem('particlesIntensity', String(clampParticlesIntensity(value)));
    } catch (_error) {
      // Ignore storage errors in private mode or blocked storage contexts.
    }
  };

  const syncParticlesControls = () => {
    document.body.dataset.particles = particlesEnabled ? 'on' : 'off';
    particlesToggleInputs.forEach((input) => {
      input.checked = particlesEnabled;
    });
    particlesStatusNodes.forEach((node) => {
      node.textContent = particlesEnabled ? 'On' : 'Off';
    });
    syncSettingsMenuControls();
  };

  const syncParticlesModeAvailability = () => {
    const isGlideMode = glideIsActive();
    document.body.dataset.particlesMode = isGlideMode ? 'glide' : 'solid';
    if (!isGlideMode) closeParticlesPanels();

    particlesControls.forEach((control) => {
      control.classList.toggle('is-disabled', !isGlideMode);
      const trigger = control.querySelector('[data-particles-gear]');
      if (trigger) {
        trigger.disabled = !isGlideMode;
        trigger.setAttribute('aria-disabled', String(!isGlideMode));
      }
    });

    particlesToggleInputs.forEach((input) => {
      input.disabled = !isGlideMode;
    });
  };

  const setParticlesPanelOpen = (control, open) => {
    if (!control) return;
    control.classList.toggle('is-open', open);
    const trigger = control.querySelector('[data-particles-gear]');
    if (trigger) trigger.setAttribute('aria-expanded', String(open));
  };

  const closeParticlesPanels = () => {
    particlesControls.forEach((control) => setParticlesPanelOpen(control, false));
  };

  const applyParticlesPreference = (enabled, { persist = false } = {}) => {
    particlesEnabled = Boolean(enabled);
    syncParticlesControls();
    if (persist) storeParticlesPreference(particlesEnabled);

    if (!particlesEnabled) {
      stopGlideParticles();
      return;
    }

    if (glideIsActive()) {
      scheduleParticlesBoot();
      syncGlideParticlesVisibility();
    }
  };

  const applyParticlesIntensityPreference = (value, { persist = false } = {}) => {
    particlesIntensity = clampParticlesIntensity(value);
    if (persist) storeParticlesIntensity(particlesIntensity);
    syncSettingsMenuControls();

    if (!particlesEnabled || !glideIsActive()) return;
    stopGlideParticles();
    scheduleParticlesBoot();
    syncGlideParticlesVisibility();
  };

  const bindParticlesControls = () => {
    if (!particlesToggleInputs.length && !particlesControls.length) return;

    particlesToggleInputs.forEach((input) => {
      input.addEventListener('change', () => {
        applyParticlesPreference(input.checked, { persist: true });
      });
    });

    particlesControls.forEach((control) => {
      const trigger = control.querySelector('[data-particles-gear]');
      if (!trigger) return;
      trigger.addEventListener('click', () => {
        if (control.classList.contains('is-disabled')) return;
        const willOpen = !control.classList.contains('is-open');
        closeParticlesPanels();
        setParticlesPanelOpen(control, willOpen);
      });
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (particlesControls.some((control) => control.contains(target))) return;
      closeParticlesPanels();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeParticlesPanels();
    });

    window.addEventListener('resize', () => {
      closeParticlesPanels();
    }, { passive: true });
  };

  const syncModeToggleUi = (isGlide) => {
    if (!modeToggle) return;
    const label = isGlide ? 'Glide on' : 'Solid on';
    modeToggle.setAttribute('aria-pressed', String(isGlide));
    modeToggle.setAttribute('title', label);
    modeToggle.setAttribute('aria-label', isGlide ? 'Switch to Solid mode' : 'Switch to Glide mode');
    const sr = modeToggle.querySelector('.btn-sr');
    if (sr) sr.textContent = label;
    if (modeToggleStatus) modeToggleStatus.textContent = label;
  };

  const setMode = (mode) => {
    closeParticlesPanels();
    closeSettingsPanels();
    document.body.dataset.mode = mode;
    const isGlide = mode === 'glide';

    if (modeToggle) {
      syncModeToggleUi(isGlide);
    }

    syncParticlesModeAvailability();

    if (isGlide) {
      if (particlesEnabled) scheduleParticlesBoot();
      window.dispatchEvent(new Event('set:activate'));
    } else {
      stopGlideParticles();
      document.body.style.removeProperty('--glide-ambient');
    }

    syncGlideParticlesVisibility();
    window.dispatchEvent(new CustomEvent('mode:changed', { detail: { mode, isGlide } }));
  };

  const readStoredMode = () => {
    try {
      const value = localStorage.getItem('viewMode');
      if (value === 'solid' || value === 'glide') return value;
    } catch (_error) {
      return 'solid';
    }
    return 'solid';
  };

  const storeMode = (mode) => {
    try {
      localStorage.setItem('viewMode', mode);
    } catch (_error) {
      // Ignore storage errors in private mode or blocked storage contexts.
    }
  };

  const readRequestedMode = () => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'solid' || mode === 'glide') return mode;
    return null;
  };

  const clearModeParam = () => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('mode')) return;
    url.searchParams.delete('mode');
    window.history.replaceState({}, '', url);
  };

  const bindModeCards = () => {
    const cards = Array.from(document.querySelectorAll('.mode-card[data-mode]'));
    if (!cards.length) return;

    const activate = (card) => {
      const { mode } = card.dataset;
      if (mode !== 'solid' && mode !== 'glide') return;
      storeMode(mode);
      window.location.href = `pages/solar-system.html?mode=${mode}`;
    };

    cards.forEach((card) => {
      card.addEventListener('click', () => activate(card));
      card.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        activate(card);
      });
    });
  };

  particlesEnabled = readStoredParticlesPreference();
  particlesIntensity = readStoredParticlesIntensity();
  syncParticlesControls();
  bindParticlesControls();

  if (isLanding) {
    document.body.removeAttribute('data-mode');
  } else if (modeToggle) {
    const syncModeFromToggle = () => {
      const currentlyGlide = modeToggle.getAttribute('aria-pressed') === 'true';
      const nextMode = currentlyGlide ? 'solid' : 'glide';
      setMode(nextMode);
      storeMode(nextMode);
    };

    const requested = readRequestedMode();
    const initial = requested || readStoredMode();
    if (requested) {
      storeMode(requested);
      clearModeParam();
    }
    setMode(initial);
    bindParticlesVisibilityLifecycle();

    modeToggle.addEventListener('click', syncModeFromToggle);
  } else {
    const requested = readRequestedMode();
    const initial = requested || readStoredMode();
    if (requested) {
      storeMode(requested);
      clearModeParam();
    }
    setMode(initial);
    bindParticlesVisibilityLifecycle();
  }

  bindModeCards();

  const navBar = document.querySelector('.nav-bar');
  const list = navBar ? Array.from(navBar.querySelectorAll('.list')) : [];
  const indicator = navBar ? navBar.querySelector('.indicator') : null;
  const settingsTriggers = navBar ? Array.from(navBar.querySelectorAll('.list-settings a, .list[data-particles-direct] a')) : [];
  let activeSettingsTrigger = settingsTriggers[0] || null;
  const desktopNavQuery = window.matchMedia('(min-width: 901px)');
  const mobileNavQuery = window.matchMedia('(max-width: 900px)');
  let desktopSidebarExpanded = false;
  let mobileSidebarExpanded = false;
  const isHomeNavItem = (item) => {
    if (!item) return false;
    if (item.classList.contains('list-home')) return true;
    const link = item.querySelector('a[href]');
    if (!link) return false;
    const hrefAttr = (link.getAttribute('href') || '').trim();
    if (!hrefAttr || hrefAttr === '#' || hrefAttr.startsWith('#')) return false;
    try {
      const destination = new URL(link.href, window.location.href);
      return /\/index\.html$/i.test(destination.pathname);
    } catch (_error) {
      return /(?:^|\/)index\.html$/i.test(hrefAttr);
    }
  };
  const isTopNavItem = (item) => Boolean(item && item.classList.contains('list-top'));
  const isTransientNavItem = (item) => Boolean(item && (isHomeNavItem(item) || isTopNavItem(item)));
  const isSettingsNavItem = (item) => Boolean(item && (item.classList.contains('list-settings') || item.hasAttribute('data-particles-direct')));
  const isPageNavItem = (item) => Boolean(item && !isSettingsNavItem(item) && !isTransientNavItem(item));
  const transientPressTimers = new WeakMap();
  const TRANSIENT_PRESS_MS = 220;

  const triggerTransientPressState = (item) => {
    if (!item || !isTransientNavItem(item)) return;
    item.classList.add('is-press-active');
    const existingTimer = transientPressTimers.get(item);
    if (existingTimer) window.clearTimeout(existingTimer);
    const timerId = window.setTimeout(() => {
      item.classList.remove('is-press-active');
      transientPressTimers.delete(item);
    }, TRANSIENT_PRESS_MS);
    transientPressTimers.set(item, timerId);
  };

  const getCurrentPageNavItem = () => {
    const byPath = list.find((item) => {
      if (!isPageNavItem(item)) return false;
      const link = item.querySelector('a[href]');
      if (!link) return false;
      const hrefAttr = link.getAttribute('href');
      if (!hrefAttr || hrefAttr === '#' || hrefAttr.startsWith('#')) return false;
      try {
        const destination = new URL(link.href, window.location.href);
        return destination.pathname === window.location.pathname;
      } catch (_error) {
        return false;
      }
    });
    if (byPath) return byPath;
    return list.find((item) => item.classList.contains('active') && isPageNavItem(item)) || list.find((item) => isPageNavItem(item)) || null;
  };

  let lastPageActiveItem = getCurrentPageNavItem();

  const applyNavSidebarState = () => {
    if (!navBar) return;
    const isDesktop = desktopNavQuery.matches;
    const isMobile = mobileNavQuery.matches;
    let shouldBeExpanded = true;
    if (isDesktop) {
      shouldBeExpanded = desktopSidebarExpanded;
    } else if (isMobile) {
      shouldBeExpanded = mobileSidebarExpanded;
    }
    navBar.classList.toggle('is-desktop-expanded', shouldBeExpanded);
    document.body.classList.toggle('is-mobile-nav-collapsed', isMobile && !shouldBeExpanded);
  };

  const navSidebarIsExpanded = () => {
    if (desktopNavQuery.matches) return desktopSidebarExpanded;
    if (mobileNavQuery.matches) return mobileSidebarExpanded;
    return false;
  };

  const restorePageActiveItem = () => {
    if (!desktopNavQuery.matches && !mobileNavQuery.matches) return;
    const currentActive = navBar ? navBar.querySelector('.list.active') : null;
    if (currentActive && isPageNavItem(currentActive)) {
      lastPageActiveItem = currentActive;
      return;
    }
    const target = (lastPageActiveItem && list.includes(lastPageActiveItem) ? lastPageActiveItem : getCurrentPageNavItem());
    if (!target || !isPageNavItem(target)) return;
    setActiveItem(target);
  };

  const toggleNavSidebar = () => {
    if (!navBar) return;
    if (desktopNavQuery.matches) {
      if (desktopSidebarExpanded) restorePageActiveItem();
      desktopSidebarExpanded = !desktopSidebarExpanded;
      applyNavSidebarState();
      return;
    }
    if (!mobileNavQuery.matches) return;
    if (mobileSidebarExpanded) restorePageActiveItem();
    mobileSidebarExpanded = !mobileSidebarExpanded;
    applyNavSidebarState();
  };

  const closeNavSidebar = () => {
    if (!navBar || !navSidebarIsExpanded()) return;
    restorePageActiveItem();
    if (desktopNavQuery.matches) {
      desktopSidebarExpanded = false;
    } else if (mobileNavQuery.matches) {
      mobileSidebarExpanded = false;
    }
    applyNavSidebarState();
  };

  const getVisibleListItems = () => list.filter((item) => item.offsetParent !== null);

  const getActiveListItem = () => {
    if (!navBar) return null;
    const activeItem = navBar.querySelector('.list.active');
    if (activeItem && activeItem.offsetParent !== null && !isTransientNavItem(activeItem)) return activeItem;
    const [firstVisible] = getVisibleListItems().filter((item) => !isTransientNavItem(item));
    return firstVisible || null;
  };

  const NAV_INDICATOR_MIN_ANIMATION_MS = 460;
  const NAV_INDICATOR_MAX_ANIMATION_MS = 760;
  const NAV_INDICATOR_PIXELS_PER_MS = 31 / 50;
  let lastIndicatorX = null;
  let lastIndicatorY = null;
  let lastActivationDurationMs = NAV_INDICATOR_MIN_ANIMATION_MS;

  const computeIndicatorDuration = (distancePx) => {
    if (!Number.isFinite(distancePx) || distancePx <= 0) return NAV_INDICATOR_MIN_ANIMATION_MS;
    const rawDuration = Math.round(distancePx / NAV_INDICATOR_PIXELS_PER_MS);
    return Math.max(NAV_INDICATOR_MIN_ANIMATION_MS, Math.min(NAV_INDICATOR_MAX_ANIMATION_MS, rawDuration));
  };

  const syncIndicatorToActive = () => {
    if (!navBar || !indicator) return NAV_INDICATOR_MIN_ANIMATION_MS;

    const activeItem = getActiveListItem();
    if (!activeItem) return NAV_INDICATOR_MIN_ANIMATION_MS;

    const isDesktop = window.matchMedia('(min-width: 901px)').matches;
    if (isDesktop) {
      const targetNode = activeItem.querySelector('.icon') || activeItem;
      const navRect = navBar.getBoundingClientRect();
      const targetRect = targetNode.getBoundingClientRect();
      const y = (targetRect.top - navRect.top) + ((targetRect.height - indicator.offsetHeight) / 2) -6;
      const fromY = lastIndicatorY ?? y;
      const durationMs = computeIndicatorDuration(Math.abs(y - fromY));
      indicator.style.transitionDuration = `${durationMs}ms`;
      indicator.style.transform = `translateY(${y}px) rotate(90deg)`;
      navBar.style.removeProperty('--notch-cx');
      lastIndicatorY = y;
      lastIndicatorX = null;
      return durationMs;
    }

    const x = activeItem.offsetLeft + ((activeItem.offsetWidth - indicator.offsetWidth) / 2);
    const fromX = lastIndicatorX ?? x;
    const durationMs = computeIndicatorDuration(Math.abs(x - fromX));
    indicator.style.transitionDuration = `${durationMs}ms`;
    indicator.style.transform = `translateX(${x}px)`;
    navBar.style.setProperty('--notch-cx', `${x + (indicator.offsetWidth / 2)}px`);
    lastIndicatorX = x;
    lastIndicatorY = null;
    return durationMs;
  };

  const setActiveItem = (item) => {
    if (!item) return NAV_INDICATOR_MIN_ANIMATION_MS;
    if (isTransientNavItem(item)) return lastActivationDurationMs;
    list.forEach((node) => node.classList.remove('active'));
    item.classList.add('active');
    if (isPageNavItem(item)) lastPageActiveItem = item;
    const durationMs = syncIndicatorToActive();
    lastActivationDurationMs = durationMs;
    return durationMs;
  };

  const shouldDelayNavigationForIndicator = (link, event) => {
    if (!link || !event) return false;
    const hrefAttr = link.getAttribute('href');
    if (!hrefAttr || hrefAttr === '#' || hrefAttr.startsWith('#')) return false;
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    const target = link.getAttribute('target');
    if (target && target !== '_self') return false;

    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin) return false;
    const isSameLocation = destination.pathname === window.location.pathname &&
      destination.search === window.location.search &&
      destination.hash === window.location.hash;
    return !isSameLocation;
  };

  list.forEach((item) => {
    if (isTransientNavItem(item)) item.classList.remove('active');
    const link = item.querySelector('a');
    if (!link) return;

    link.addEventListener('click', (event) => {
      const isSettingsItem = item.classList.contains('list-settings') || item.hasAttribute('data-particles-direct');
      if (isSettingsItem) {
        event.preventDefault();
        return;
      }

      if (isTransientNavItem(item)) {
        triggerTransientPressState(item);
        if (shouldDelayNavigationForIndicator(link, event)) {
          event.preventDefault();
          window.setTimeout(() => {
            window.location.assign(link.href);
          }, TRANSIENT_PRESS_MS);
        }
        return;
      }

      if ((desktopNavQuery.matches || mobileNavQuery.matches) && item.classList.contains('active')) {
        event.preventDefault();
        toggleNavSidebar();
        return;
      }

      if (shouldDelayNavigationForIndicator(link, event)) {
        event.preventDefault();
        const durationMs = setActiveItem(item);
        const navigationDelayMs = Math.max(NAV_INDICATOR_MIN_ANIMATION_MS, durationMs + 40);
        window.setTimeout(() => {
          window.location.assign(link.href);
        }, navigationDelayMs);
        return;
      }

      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = link.getAttribute('target');
      if (target && target !== '_self') return;

      setActiveItem(item);
    });
  });

  const initializeIndicatorPosition = () => {
    if (!indicator) return;
    indicator.style.transition = 'none';
    syncIndicatorToActive();
// Trigger a redraw to skip the transition for now.
    void indicator.offsetWidth;
    indicator.style.removeProperty('transition');
  };

  applyNavSidebarState();
  initializeIndicatorPosition();
  window.addEventListener('resize', syncIndicatorToActive);
  window.addEventListener('resize', applyNavSidebarState, { passive: true });
  window.addEventListener('mode:changed', () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        syncIndicatorToActive();
      });
    });
  });

  // Settings panel state and placement keep the flyouts anchored to the nav item.
  const settingsDesktopQuery = window.matchMedia('(min-width: 901px)');
  const SETTINGS_PANEL_GAP_PX = 25;
  const SETTINGS_REPOSITION_DELAYS_MS = [120, 260, 520];
  let settingsOpenTimer = 0;
  let settingsModeTooltipTimer = 0;
  let settingsConfirmPanel = null;
  let settingsMenuPanel = null;
  let settingsModeTooltip = null;
  let settingsCancelBtn = null;
  let settingsOkBtn = null;
  let settingsToggleInput = null;
  let settingsIntensityInput = null;
  let settingsIntensityValue = null;
  let settingsIntensityInfoWrap = null;
  let settingsIntensityInfoBtn = null;

  document.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (typeof event.button === 'number' && event.button !== 0) return;
    if (!navSidebarIsExpanded()) return;
    if (navBar?.contains(target)) return;
    if (settingsConfirmPanel?.contains(target)) return;
    if (settingsMenuPanel?.contains(target)) return;
    if (settingsModeTooltip?.contains(target)) return;
    closeNavSidebar();
  });

  const ensureSettingsModeTooltip = () => {
    if (settingsModeTooltip) return;
    settingsModeTooltip = document.createElement('span');
    settingsModeTooltip.className = 'settings-mode-tooltip';
    settingsModeTooltip.setAttribute('role', 'tooltip');
    settingsModeTooltip.setAttribute('aria-hidden', 'true');
    settingsModeTooltip.hidden = true;
    settingsModeTooltip.inert = true;
    settingsModeTooltip.textContent = 'Settings menu is only available in Glide mode.';
    document.body.append(settingsModeTooltip);
  };

  const createSettingsPanels = () => {
    if (!settingsTriggers.length || settingsConfirmPanel || settingsMenuPanel) return;

    settingsConfirmPanel = document.createElement('div');
    settingsConfirmPanel.className = 'settings-confirm-tooltip';
    settingsConfirmPanel.setAttribute('role', 'group');
    settingsConfirmPanel.setAttribute('aria-label', 'Settings confirmation');
    settingsConfirmPanel.setAttribute('aria-hidden', 'true');
    settingsConfirmPanel.innerHTML = `
      <p class="settings-confirm-text">Open settings menu?</p>
      <div class="settings-confirm-actions">
        <button type="button" class="settings-confirm-btn is-cancel" data-settings-cancel>Cancel</button>
        <button type="button" class="settings-confirm-btn is-ok" data-settings-ok>OK</button>
      </div>
    `;

    settingsMenuPanel = document.createElement('div');
    settingsMenuPanel.className = 'settings-flyout-menu';
    settingsMenuPanel.setAttribute('role', 'group');
    settingsMenuPanel.setAttribute('aria-label', 'Settings menu');
    settingsMenuPanel.setAttribute('aria-hidden', 'true');
    settingsMenuPanel.innerHTML = `
      <div class="settings-flyout-row">
        <span class="settings-flyout-label">Particles</span>
        <label class="settings-switch" aria-label="Toggle particles">
          <input type="checkbox" data-settings-particles-toggle aria-label="Toggle particles">
          <span class="settings-switch-track" aria-hidden="true"></span>
        </label>
      </div>
      <div class="settings-flyout-row settings-flyout-row-intensity">
        <label class="settings-flyout-label" for="settingsIntensityRange">Particles Intensity</label>
        <div class="settings-intensity-main">
          <div class="settings-intensity-slider-wrap">
            <div class="settings-intensity-endpoints" aria-hidden="true">
              <span>MIN</span>
              <span>MAX</span>
            </div>
            <input
              id="settingsIntensityRange"
              class="settings-intensity-range"
              type="range"
              min="${PARTICLES_INTENSITY_MIN}"
              max="${PARTICLES_INTENSITY_MAX}"
              step="${PARTICLES_INTENSITY_STEP}"
              data-settings-intensity
            >
          </div>
          <div class="settings-intensity-readout">
            <output class="settings-intensity-value" data-settings-intensity-value>${PARTICLES_INTENSITY_DEFAULT}</output>
            <span class="settings-intensity-info-wrap" data-settings-intensity-info-wrap>
              <button
                type="button"
                class="settings-intensity-info-btn"
                aria-label="Warning: Stability information"
                aria-describedby="settingsIntensityRiskTooltip"
                aria-expanded="false"
                data-settings-intensity-info-btn
              >i</button>
              <span
                id="settingsIntensityRiskTooltip"
                class="settings-intensity-tooltip"
                role="tooltip"
              >MAX settings may cause device instability. Use at your own risk.</span>
            </span>
          </div>
        </div>
      </div>
    `;

    document.body.append(settingsConfirmPanel, settingsMenuPanel);

    settingsCancelBtn = settingsConfirmPanel.querySelector('[data-settings-cancel]');
    settingsOkBtn = settingsConfirmPanel.querySelector('[data-settings-ok]');
    settingsToggleInput = settingsMenuPanel.querySelector('[data-settings-particles-toggle]');
    settingsIntensityInput = settingsMenuPanel.querySelector('[data-settings-intensity]');
    settingsIntensityValue = settingsMenuPanel.querySelector('[data-settings-intensity-value]');
    settingsIntensityInfoWrap = settingsMenuPanel.querySelector('[data-settings-intensity-info-wrap]');
    settingsIntensityInfoBtn = settingsMenuPanel.querySelector('[data-settings-intensity-info-btn]');

    syncSettingsMenuControls = () => {
      if (settingsToggleInput) settingsToggleInput.checked = particlesEnabled;
      if (settingsIntensityInput) settingsIntensityInput.value = String(particlesIntensity);
      if (settingsIntensityValue) settingsIntensityValue.textContent = String(particlesIntensity);
    };
    syncSettingsMenuControls();
  };

  const positionSettingsPanel = (panel) => {
    if (!panel || !activeSettingsTrigger) return;
    const settingsItem = activeSettingsTrigger.closest('.list') || activeSettingsTrigger;
    const anchor = settingsItem.querySelector('.icon') || activeSettingsTrigger || settingsItem;
    if (!anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const spacing = SETTINGS_PANEL_GAP_PX;

    panel.style.left = '0px';
    panel.style.top = '0px';
    const panelRect = panel.getBoundingClientRect();

    let left = 0;
    let top = 0;
    if (settingsDesktopQuery.matches) {
      left = anchorRect.right + spacing;
      top = (anchorRect.top + (anchorRect.height / 2)) - (panelRect.height / 2);
    } else {
      left = anchorRect.right + spacing;
      top = anchorRect.top - panelRect.height - spacing;
    }

    const maxLeft = Math.max(12, window.innerWidth - panelRect.width - 12);
    const maxTop = Math.max(12, window.innerHeight - panelRect.height - 12);
    left = Math.min(Math.max(left, 12), maxLeft);
    top = Math.min(Math.max(top, 12), maxTop);

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  };

  const positionSettingsModeTooltip = () => {
    if (!settingsModeTooltip || !activeSettingsTrigger) return;
    const settingsItem = activeSettingsTrigger.closest('.list') || activeSettingsTrigger;
    const anchor = settingsItem.querySelector('.icon') || activeSettingsTrigger || settingsItem;
    if (!anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const spacing = Math.max(10, Math.round(SETTINGS_PANEL_GAP_PX * 0.6));

    settingsModeTooltip.style.left = '0px';
    settingsModeTooltip.style.top = '0px';
    const tipRect = settingsModeTooltip.getBoundingClientRect();

    let left = (anchorRect.left + (anchorRect.width / 2)) - (tipRect.width / 2);
    let top = anchorRect.top - tipRect.height - spacing;

    const maxLeft = Math.max(12, window.innerWidth - tipRect.width - 12);
    const maxTop = Math.max(12, window.innerHeight - tipRect.height - 12);
    left = Math.min(Math.max(left, 12), maxLeft);
    top = Math.min(Math.max(top, 12), maxTop);

    settingsModeTooltip.style.left = `${Math.round(left)}px`;
    settingsModeTooltip.style.top = `${Math.round(top)}px`;
  };

  const scheduleSettingsPanelReposition = (panel) => {
    if (!panel) return;
    SETTINGS_REPOSITION_DELAYS_MS.forEach((delayMs) => {
      window.setTimeout(() => {
        if (!panel.classList.contains('is-open')) return;
        positionSettingsPanel(panel);
      }, delayMs);
    });
  };

  const setSettingsPanelOpen = (panel, open) => {
    if (!panel) return;
    if (!open) {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && panel.contains(focused)) {
        focused.blur();
        if (activeSettingsTrigger instanceof HTMLElement) {
          activeSettingsTrigger.focus({ preventScroll: true });
        }
      }
    }
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    panel.toggleAttribute('hidden', !open);
    panel.inert = !open;
    panel.style.display = open ? 'block' : 'none';
    panel.style.opacity = open ? '1' : '0';
    panel.style.visibility = open ? 'visible' : 'hidden';
    panel.style.pointerEvents = open ? 'auto' : 'none';
    if (open) {
      positionSettingsPanel(panel);
      scheduleSettingsPanelReposition(panel);
    }
  };

  const clearSettingsOpenTimer = () => {
    if (!settingsOpenTimer) return;
    window.clearTimeout(settingsOpenTimer);
    settingsOpenTimer = 0;
  };

  const clearSettingsModeTooltipTimer = () => {
    if (!settingsModeTooltipTimer) return;
    window.clearTimeout(settingsModeTooltipTimer);
    settingsModeTooltipTimer = 0;
  };

  const setSettingsModeTooltipOpen = (open) => {
    if (!settingsModeTooltip) return;
    settingsModeTooltip.classList.toggle('is-open', open);
    settingsModeTooltip.setAttribute('aria-hidden', open ? 'false' : 'true');
    settingsModeTooltip.hidden = !open;
    settingsModeTooltip.inert = !open;
    if (open) positionSettingsModeTooltip();
  };

  const hideSettingsModeTooltip = () => {
    clearSettingsModeTooltipTimer();
    setSettingsModeTooltipOpen(false);
  };

  const showSettingsModeTooltip = () => {
    ensureSettingsModeTooltip();
    if (!settingsModeTooltip) return;
    clearSettingsModeTooltipTimer();
    setSettingsModeTooltipOpen(true);
    settingsModeTooltipTimer = window.setTimeout(() => {
      settingsModeTooltipTimer = 0;
      setSettingsModeTooltipOpen(false);
    }, 2400);
  };

  const setSettingsIntensityInfoOpen = (open) => {
    if (!settingsIntensityInfoWrap || !settingsIntensityInfoBtn) return;
    settingsIntensityInfoWrap.classList.toggle('is-open', open);
    settingsIntensityInfoBtn.setAttribute('aria-expanded', String(open));
  };

  closeSettingsPanels = () => {
    clearSettingsOpenTimer();
    hideSettingsModeTooltip();
    setSettingsIntensityInfoOpen(false);
    setSettingsPanelOpen(settingsConfirmPanel, false);
    setSettingsPanelOpen(settingsMenuPanel, false);
    restorePageActiveItem();
  };

  const openSettingsConfirmPanel = () => {
    createSettingsPanels();
    if (!settingsConfirmPanel) return;
    setSettingsPanelOpen(settingsMenuPanel, false);
    setSettingsPanelOpen(settingsConfirmPanel, true);
  };

  const openSettingsMenuPanel = () => {
    createSettingsPanels();
    if (!settingsMenuPanel) return;
    setSettingsIntensityInfoOpen(false);
    syncSettingsMenuControls();
    setSettingsPanelOpen(settingsConfirmPanel, false);
    setSettingsPanelOpen(settingsMenuPanel, true);
  };

  if (settingsTriggers.length) {
    createSettingsPanels();

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest('.list-settings a, .list[data-particles-direct] a');
      if (!trigger) return;
      event.preventDefault();
      activeSettingsTrigger = trigger;

      if (!glideIsActive()) {
        closeSettingsPanels();
        showSettingsModeTooltip();
        return;
      }

      hideSettingsModeTooltip();
      const triggerItem = trigger.closest('.list');
      const durationMs = triggerItem ? setActiveItem(triggerItem) : lastActivationDurationMs;
      const openDelayMs = Math.min(620, Math.max(240, Math.round(durationMs * (41 / 50))));
      clearSettingsOpenTimer();
      settingsOpenTimer = window.setTimeout(() => {
        settingsOpenTimer = 0;
        openSettingsConfirmPanel();
      }, openDelayMs);
    });

    settingsCancelBtn?.addEventListener('click', () => {
      closeSettingsPanels();
    });

    settingsOkBtn?.addEventListener('click', () => {
      openSettingsMenuPanel();
    });

    settingsToggleInput?.addEventListener('change', () => {
      applyParticlesPreference(settingsToggleInput.checked, { persist: true });
    });

    settingsIntensityInput?.addEventListener('input', () => {
      const next = clampParticlesIntensity(settingsIntensityInput.value);
      settingsIntensityValue.textContent = String(next);
    });

    settingsIntensityInput?.addEventListener('change', () => {
      const next = clampParticlesIntensity(settingsIntensityInput.value);
      applyParticlesIntensityPreference(next, { persist: true });
    });

    settingsIntensityInfoBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      const openNow = !settingsIntensityInfoWrap?.classList.contains('is-open');
      setSettingsIntensityInfoOpen(openNow);
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!settingsIntensityInfoWrap?.contains(target)) setSettingsIntensityInfoOpen(false);
      if (activeSettingsTrigger?.contains(target)) return;
      const activeSettingsItem = activeSettingsTrigger?.closest('.list');
      if (activeSettingsItem?.contains(target)) return;
      if (settingsConfirmPanel?.contains(target)) return;
      if (settingsMenuPanel?.contains(target)) return;
      if (settingsModeTooltip?.contains(target)) return;
      closeSettingsPanels();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setSettingsIntensityInfoOpen(false);
      }
      if (event.key !== 'Escape') return;
      closeSettingsPanels();
    });

    window.addEventListener('resize', () => {
      if (settingsConfirmPanel?.classList.contains('is-open')) positionSettingsPanel(settingsConfirmPanel);
      if (settingsMenuPanel?.classList.contains('is-open')) positionSettingsPanel(settingsMenuPanel);
      if (settingsModeTooltip?.classList.contains('is-open')) positionSettingsModeTooltip();
    }, { passive: true });
  }

  const backToTopTriggers = Array.from(document.querySelectorAll('[data-back-to-top]'));
  if (backToTopTriggers.length) {
    backToTopTriggers.forEach((trigger) => trigger.addEventListener('click', (event) => {
      event.preventDefault();
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    }));
  }

  const initSetModule = () => {
    const setRoots = Array.from(document.querySelectorAll('[data-feature="set"]'));
    if (!setRoots.length) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cardByTheme = new Map();
    const cardPreviewByTheme = new Map();
    document.querySelectorAll('.astra-grid .card[data-set-theme]').forEach((card) => {
      const key = normaliseKey(card.getAttribute('data-set-theme') || '');
      if (!key || cardPreviewByTheme.has(key)) return;
      cardByTheme.set(key, card);
      const src = card.getAttribute('data-preview-src') || card.querySelector('.card-media')?.getAttribute('src') || '';
      if (src) cardPreviewByTheme.set(key, src);
    });

    const THEME_TOKENS = {
      sun: 'var(--color-sun)',
      mercury: 'var(--color-mercury)',
      venus: 'var(--color-venus)',
      earth: 'var(--color-earth)',
      moon: 'var(--color-moon)',
      mars: 'var(--color-mars)',
      jupiter: 'var(--color-jupiter)',
      saturn: 'var(--color-saturn)',
      uranus: 'var(--color-uranus)',
      neptune: 'var(--color-neptune)',
      neareststars: 'var(--color-nearest-stars)',
      localinterstellarcloud: 'var(--color-local-cloud)',
      openclusters: 'var(--color-open-cluster)',
      orionnebula: 'var(--color-orion-nebula)',
      globularclusters: 'var(--color-globular-clusters)',
      galacticcenter: 'var(--color-galactic-center)',
      galacticdiskedge: 'var(--color-galactic-disk-edge)',
      galactichalo: 'var(--color-galactic-halo)',
      localgroup: 'var(--color-local-group)',
      canismajordwarf: 'var(--color-canis-major-dwarf)',
      magellaniccloud: 'var(--color-magellanic-cloud)',
      magellanicclouds: 'var(--color-magellanic-cloud)',
      andromedagalaxy: 'var(--color-andromeda-galaxy)',
      triangulumgalaxy: 'var(--color-triangulum-galaxy)',
      virgosupercluster: 'var(--color-virgo-supercluster)',
      cosmicweb: 'var(--color-cosmic-web)',
      astraweb: 'var(--color-cosmic-web)',
      observableuniverse: 'var(--color-observable-universe)',
    };

    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
    const lerp = (a, b, t) => a + (b - a) * t;

    setRoots.forEach((root) => {
      const rootEl = root;
      if (rootEl.dataset.setInit === '1') return;
      rootEl.dataset.setInit = '1';

      const track = rootEl.querySelector('.set-track');
      const items = Array.from(rootEl.querySelectorAll('.set-object'));
      const viewport = rootEl.querySelector('.set-viewport');
      if (!track || !items.length) return;
      const itemMeta = items.map((item) => ({
        item,
        inner: item.querySelector('.set-inner'),
        details: item.querySelector('details.set-review'),
      }));

      let rafId = 0;
      let settleTimer = 0;
      let isScrolling = false;
      let scrollStopTimer = 0;
      let currentPreviewSrc = '';

      const applyThemeFromItem = (item) => {
        const key = normaliseKey(item?.getAttribute('data-set-theme') || '');
        const accent = THEME_TOKENS[key];
        if (!accent) return;

        rootEl.style.setProperty('--set-accent', accent);
        viewport?.style.setProperty('--set-bg', accent);
        if (glideIsActive()) {
          document.body.style.setProperty('--glide-ambient', accent);
        }
      };

      const getPreviewSrc = (item) => {
        if (!item) return '';

        const direct = item.getAttribute('data-preview-src') || '';
        if (direct) return direct;

        const key = normaliseKey(item.getAttribute('data-set-theme') || '');
        if (!key) return '';

        const sourceCard = cardByTheme.get(key);
        const livePreview = sourceCard?.getAttribute('data-preview-src') || sourceCard?.querySelector('.card-media')?.getAttribute('src') || '';
        if (livePreview) {
          cardPreviewByTheme.set(key, livePreview);
          return livePreview;
        }

        return cardPreviewByTheme.get(key) || '';
      };

      const applyPreviewFromItem = (item) => {
        const media = document.getElementById('glideMedia');
        if (!media) return;

        const basePreviewSrc = getPreviewSrc(item);
        let previewSrc = basePreviewSrc;
        if (window.matchMedia('(max-width: 480px)').matches) {
          previewSrc = addImageVariantSuffix(basePreviewSrc, '-220');
        } else if (window.matchMedia('(max-width: 900px)').matches) {
          previewSrc = addImageVariantSuffix(basePreviewSrc, '-320');
        }
        if (!previewSrc) {
          currentPreviewSrc = '';
          media.style.backgroundImage = '';
          media.classList.remove('is-visible');
          return;
        }

        if (previewSrc === currentPreviewSrc) return;
        currentPreviewSrc = previewSrc;
        media.style.backgroundImage = `url("${previewSrc}")`;
        media.classList.add('is-visible');
        media.setAttribute('aria-hidden', 'true');
      };

      const setActive = (activeItem) => {
        items.forEach((item) => item.classList.toggle('is-active', item === activeItem));
        applyThemeFromItem(activeItem);
        applyPreviewFromItem(activeItem);
      };

      function measureAndUpdate() {
        rafId = 0;
        if (!glideIsActive()) return;

        const styles = getComputedStyle(rootEl);
        const getNumberVar = (name, fallback) => {
          const v = styles.getPropertyValue(name).trim();
          const n = Number.parseFloat(v);
          return Number.isFinite(n) ? n : fallback;
        };

        const radius = getNumberVar('--set-radius', 520);
        const thetaMax = getNumberVar('--set-theta-max', 27 / 10);
        const depth = getNumberVar('--set-depth', 220);

        const rotZMax = styles.getPropertyValue('--set-rotate-z').trim() || '24deg';
        const rotYMax = styles.getPropertyValue('--set-rotate-y').trim() || '30deg';

        const focusRatio = getNumberVar('--set-focus-ratio', 0.5);
        const trackHeight = track.clientHeight;
        const focusY = trackHeight * focusRatio;
        const maxDistance = trackHeight * 0.5;
        const scrollTop = track.scrollTop;

        const focusScale = getNumberVar('--state-scale-focus', 23 / 25);
        const adjacentScale = getNumberVar('--state-scale-adjacent', 23 / 25);
        const farScale = getNumberVar('--state-scale-far', 43 / 50);

        const focusOpacity = getNumberVar('--state-opacity-focus', 1);
        const adjacentOpacity = getNumberVar('--state-opacity-adjacent', 11 / 20);
        const farOpacity = getNumberVar('--state-opacity-far', 0.3);

        const blurEnabled = window.matchMedia('(max-width: 899px)').matches === false;
        const blur0 = blurEnabled ? getNumberVar('--blur-0', 0) : 0;
        const blur2 = blurEnabled ? getNumberVar('--blur-2', 10000) : 0;
        const blur3 = blurEnabled ? getNumberVar('--blur-3', 1) : 0;

        let bestItem = null;
        let bestAbs = Infinity;
        let openItem = null;

        itemMeta.forEach(({ item, inner, details }) => {
          if (!inner) return;
          const isOpen = Boolean(details?.open);
          const centerY = (item.offsetTop - scrollTop) + (item.offsetHeight * 0.5);

          const delta = centerY - focusY;
          const abs = Math.abs(delta);
          const norm = clamp(abs / maxDistance, 0, 1);

          if (isOpen) openItem = item;
          if (abs < bestAbs) {
            bestAbs = abs;
            bestItem = item;
          }

          let scale = farScale;
          let opacity = farOpacity;
          let blur = blur3;

          const isFocusZone = norm < 11 / 50;
          const isAdjacentZone = !isFocusZone && norm < 11 / 20;

          item.classList.toggle('is-far', !isFocusZone && !isAdjacentZone);
          item.classList.toggle('is-adjacent', isAdjacentZone);

          if (isFocusZone) {
            scale = focusScale;
            opacity = focusOpacity;
            blur = blur0;
          } else if (isAdjacentZone) {
            const t = (norm - (11 / 50)) / ((11 / 20) - (11 / 50));
            scale = lerp(adjacentScale, focusScale, 1 - t);
            opacity = lerp(adjacentOpacity, focusOpacity, 1 - t);
            blur = blur2;
          }

          const sign = delta < 0 ? -1 : 1;
          const thetaAbs = norm * thetaMax;

          const offsetX = (1 - Math.cos(thetaAbs)) * radius * sign;
          const offsetZ = Math.sin(thetaAbs) * depth;

          if (isOpen) {
            scale = Math.max(scale, focusScale);
            opacity = focusOpacity;
            blur = blur0;
            inner.style.transform = `translate3d(${offsetX.toFixed(2)}px, 0, ${offsetZ.toFixed(2)}px) scale(${scale.toFixed(3)})`;
          } else if (prefersReducedMotion) {
            inner.style.transform = `translate3d(${offsetX.toFixed(2)}px, 0, 0) scale(${scale.toFixed(3)})`;
          } else {
            inner.style.transform = `translate3d(${offsetX.toFixed(2)}px, 0, ${offsetZ.toFixed(2)}px) rotateZ(calc(${rotZMax} * ${sign} * ${norm})) rotateY(calc(${rotYMax} * ${sign} * ${norm})) scale(${scale.toFixed(3)})`;
          }

          inner.style.opacity = String(opacity);
          inner.style.filter = blur ? `blur(${blur}px)` : 'none';
        });

        if (openItem) bestItem = openItem;
        if (bestItem) setActive(bestItem);

        if (isScrolling && !rafId) {
          rafId = window.requestAnimationFrame(measureAndUpdate);
        }
      }

      const requestUpdate = () => {
        if (rafId) return;
        rafId = window.requestAnimationFrame(measureAndUpdate);
      };

      const settle = () => {
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          measureAndUpdate();
        }, 90);
      };

      const bindDetailToggles = () => {
        itemMeta.forEach(({ details }) => {
          if (!details || details.dataset.toggleBound === '1') return;
          details.dataset.toggleBound = '1';
          details.addEventListener('toggle', () => {
            requestUpdate();
            settle();
          });
        });
      };

      const closeOpenDetails = () => {
        itemMeta.forEach(({ details }) => {
          if (details?.open) details.open = false;
        });
      };

      const isSetContextActive = () => {
        const activeEl = document.activeElement;
        if (track.matches(':hover')) return true;
        if (activeEl && (activeEl === track || track.contains(activeEl))) return true;
        return false;
      };

      track.addEventListener(
        'scroll',
        () => {
          isScrolling = true;
          window.clearTimeout(scrollStopTimer);
          scrollStopTimer = window.setTimeout(() => {
            isScrolling = false;
          }, 120);
          closeOpenDetails();
          requestUpdate();
          settle();
        },
        { passive: true },
      );

      rootEl.addEventListener('keydown', (e) => {
        if (!isSetContextActive()) return;

        const step = items[0]?.offsetHeight || 160;

        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          e.preventDefault();
          track.scrollBy({ top: step, left: 0, behavior: 'smooth' });
          requestUpdate();
          settle();
          return;
        }

        if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          track.scrollBy({ top: -step, left: 0, behavior: 'smooth' });
          requestUpdate();
          settle();
          return;
        }

        if (e.key === 'Home') {
          e.preventDefault();
          track.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
          requestUpdate();
          settle();
          return;
        }

        if (e.key === 'End') {
          e.preventDefault();
          track.scrollTo({ top: track.scrollHeight, left: 0, behavior: 'smooth' });
          requestUpdate();
          settle();
        }
      });

      window.addEventListener('resize', requestUpdate);
      window.addEventListener('set:activate', () => {
        requestUpdate();
        settle();
      });
      bindDetailToggles();
      requestUpdate();
    });
  };

  let setModuleInitialised = false;
  const ensureSetModule = () => {
    if (setModuleInitialised) return;
    setModuleInitialised = true;
    initSetModule();
  };

  const scheduleSetModuleInit = ({ immediate = false } = {}) => {
    if (!glideIsActive()) return;
    if (immediate) {
      ensureSetModule();
      return;
    }

    const boot = () => {
      if (!glideIsActive()) return;
      ensureSetModule();
    };

    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(boot, { timeout: 350 });
      return;
    }

    window.setTimeout(boot, 80);
  };

  scheduleSetModuleInit({ immediate: glideIsActive() });
  window.addEventListener('set:activate', () => scheduleSetModuleInit());

  const setCardFocus = (card) => {
    if (!card) return;
    const hostCard = card.classList.contains('card-overlay-card') ? card.closest('.card:not(.card-overlay-card)') : card;
    if (!hostCard) return;

    const grid = hostCard.closest('.astra-grid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.card:not(.card-overlay-card)'));
    grid.classList.add('is-focus-mode');
    cards.forEach((c) => c.classList.toggle('is-focus', c === hostCard));
  };

  const clearCardFocus = (card) => {
    if (!card) return;
    const hostCard = card.classList.contains('card-overlay-card') ? card.closest('.card:not(.card-overlay-card)') : card;
    if (!hostCard) return;

    const grid = hostCard.closest('.astra-grid');
    if (!grid) return;

    const openCard = grid.querySelector('.card[data-popup-open="1"]');
    if (openCard) {
      setCardFocus(openCard);
      return;
    }

    const focusedCard = grid.querySelector('.card:focus-within');
    if (focusedCard) {
      setCardFocus(focusedCard);
      return;
    }

    grid.classList.remove('is-focus-mode');
    grid.querySelectorAll('.card.is-focus').forEach((c) => c.classList.remove('is-focus'));
  };

  const closeOverlay = (overlay) => {
    const overlayEl = overlay;
    if (!overlayEl) return;
    overlayEl.hidden = true;
    delete overlayEl.dataset.overlayOpen;
    clearCardFocus(overlayEl);
  };

  const initCardFocus = () => {
    const grids = Array.from(document.querySelectorAll('.astra-grid'));
    if (!grids.length) return;

    grids.forEach((grid) => {
      const cards = Array.from(grid.querySelectorAll('.card:not(.card-overlay-card)'));
      cards.forEach((card) => {
        card.addEventListener('mouseenter', () => setCardFocus(card));
        card.addEventListener('mouseleave', () => {
          if (card.dataset.popupOpen === '1') return;
          clearCardFocus(card);
        });
        card.addEventListener('focusin', () => setCardFocus(card));
        card.addEventListener('click', () => setCardFocus(card));
      });
    });
  };

  // Popup and overlay wiring for card details, outside-click close, and escape close.
  const initPopups = () => {
    const triggers = Array.from(document.querySelectorAll('.info-trigger[aria-controls]'));
    if (!triggers.length) return;

    const closePopup = (popup) => {
      const popupEl = popup;
      popupEl.hidden = true;
      popupEl.setAttribute('aria-hidden', 'true');

      const trigger = document.querySelector(`.info-trigger[aria-controls="${popupEl.id}"]`);
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }

      const card = popupEl.closest('.card');
      if (card) {
        delete card.dataset.popupOpen;
        clearCardFocus(card);
      }
    };

    const closeAll = () => {
      document.querySelectorAll('.popup[role="dialog"]').forEach((dialogEl) => {
        const dialog = dialogEl;
        dialog.hidden = true;
        dialog.setAttribute('aria-hidden', 'true');
      });
      triggers.forEach((b) => b.setAttribute('aria-expanded', 'false'));
      document.querySelectorAll('.card[data-popup-open]').forEach((openCardEl) => {
        const openCard = openCardEl;
        delete openCard.dataset.popupOpen;
        clearCardFocus(openCard);
      });
    };

    triggers.forEach((btn) => {
      const id = btn.getAttribute('aria-controls');
      const popup = id ? document.getElementById(id) : null;
      if (!popup) return;

      popup.hidden = true;
      popup.setAttribute('aria-hidden', 'true');

      btn.addEventListener('click', () => {
        const isOpen = !popup.hidden;
        closeAll();

        if (!isOpen) {
          popup.hidden = false;
          popup.setAttribute('aria-hidden', 'false');
          btn.setAttribute('aria-expanded', 'true');

          const card = popup.closest('.card');
          if (card) {
            card.dataset.popupOpen = '1';
            setCardFocus(card);
          }

          const closeBtn = popup.querySelector('.popup-close, button[aria-label=\'Close\']');
          if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
        }
      });
    });

    document.querySelectorAll('[data-overlay-target]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const targetId = btn.getAttribute('data-overlay-target');
        if (!targetId) return;
        const target = document.getElementById(targetId);
        if (!target) return;

        target.removeAttribute('hidden');
        target.dataset.overlayOpen = '1';
        setCardFocus(target);

        const popup = e.currentTarget.closest ? e.currentTarget.closest('.popup[role="dialog"]') : null;
        if (popup) closePopup(popup);
      });
    });

    document.querySelectorAll('[data-overlay-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const overlay = btn.closest('.card-overlay-card');
        if (overlay) closeOverlay(overlay);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const openPopup = document.querySelector('.popup[role="dialog"]:not([hidden])');
      if (openPopup) {
        closePopup(openPopup);
        const card = openPopup.closest('.card');
        const activeEl = document.activeElement;
        if (card && activeEl && card.contains(activeEl) && typeof activeEl.blur === 'function') {
          activeEl.blur();
          clearCardFocus(card);
        }
      }
      const openOverlay = document.querySelector('.card-overlay-card:not([hidden])');
      if (openOverlay) closeOverlay(openOverlay);
    });

    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const openPopup = document.querySelector('.popup[role="dialog"]:not([hidden])');
      if (openPopup && !openPopup.contains(target)) {
        const popupOpener = target.closest('.info-trigger');
        if (!popupOpener) {
          closePopup(openPopup);
          const card = openPopup.closest('.card');
          const activeEl = document.activeElement;
          if (card && activeEl && card.contains(activeEl) && typeof activeEl.blur === 'function') {
            activeEl.blur();
            clearCardFocus(card);
          }
        }
      }

      const openOverlay = document.querySelector('.card-overlay-card:not([hidden])');
      if (openOverlay && !openOverlay.contains(target)) {
        const overlayOpener = target.closest('[data-overlay-target]');
        if (!overlayOpener) closeOverlay(openOverlay);
      }
    });

    document.querySelectorAll('.popup-close, button[aria-label=\'Close\']').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const popup = e.currentTarget.closest ? e.currentTarget.closest('.popup[role="dialog"]') : null;
        if (popup) closePopup(popup);
      });
    });
  };

  initCardFocus();
  initPopups();
});
