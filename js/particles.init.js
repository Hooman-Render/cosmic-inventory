'use strict';

import { createParticlesEngine, loadPresetJson } from './particles.engine.js';

const halveMobileParticleCount = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  return Math.max(120, Math.round(value * 0.5));
};

const optimizePresetForMobile = (preset, view) => {
  if (!preset || typeof preset !== 'object') return preset;
  if (!view || !view.matchMedia('(max-width: 900px)').matches) return preset;

  return {
    ...preset,
    particleCount: halveMobileParticleCount(preset.particleCount),
    particleCountSmall: halveMobileParticleCount(preset.particleCountSmall),
    particleCountLarge: halveMobileParticleCount(preset.particleCountLarge),
  };
};

// Create and start the particle engine for the current page host.
export const initParticleForge = async ({
  hostSelector = '.particles',
  presetPath = '../presets/hero_Intro_glide.json',
  preset = null,
} = {}) => {
  const host = typeof globalThis === 'undefined'
    ? null
    : globalThis.document?.querySelector(hostSelector) || null;
  if (!host) return null;

  const view = host.ownerDocument?.defaultView || null;
  const fetchImpl = view && typeof view.fetch === 'function' ? view.fetch.bind(view) : null;
  const resolvedPreset = preset || await loadPresetJson(presetPath, fetchImpl);
  const optimizedPreset = optimizePresetForMobile(resolvedPreset, view);
  const engine = createParticlesEngine(host, optimizedPreset);
  if (!engine) return null;

  engine.start();
  return engine;
};
