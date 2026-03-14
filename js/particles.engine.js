'use strict';

import * as THREE from 'https://unpkg.com/three@0.128.0/build/three.module.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

const easings = {
  linear: (t) => t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
};

const getCssVarColor = (doc, view, name, fallback) => {
  if (!doc || !view) return fallback;
  const rootStyles = view.getComputedStyle(doc.documentElement);
  const v = rootStyles.getPropertyValue(name).trim();
  return v || fallback;
};

const pickText = (cfg, doc) => {
  if (cfg.textOverride) return String(cfg.textOverride).trim();
  if (cfg.textSelector) {
    if (!doc) return cfg.textFallback || 'PARTICLE FORGE';
    const el = doc.querySelector(cfg.textSelector);
    const t = el ? el.textContent : '';
    const cleaned = String(t || '').trim();
    if (cleaned) return cleaned;
  }
  return cfg.textFallback || 'PARTICLE FORGE';
};

const buildTextPoints = (text, width, height, targetCount, cfg, doc) => {
  if (!doc) return [];
  const canvas = doc.createElement('canvas');
  canvas.width = cfg.textCanvasW;
  canvas.height = cfg.textCanvasH;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const baseFontSize = cfg.textBaseFontSize;
  ctx.font = `${cfg.textFontWeight} ${baseFontSize}px ${cfg.textFontFamily}`;

  const maxTextWidth = canvas.width * cfg.textMaxWidthFactor;
  const metrics = ctx.measureText(text);
  const scale = metrics.width > 0 ? Math.min(1, maxTextWidth / metrics.width) : 1;
  const fontSize = Math.max(cfg.textMinFontSize, Math.floor(baseFontSize * scale));

  ctx.font = `${cfg.textFontWeight} ${fontSize}px ${cfg.textFontFamily}`;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = img;

  const points = [];
  const step = Math.max(1, cfg.textSampleStep);
  const alphaMin = Math.max(1, Math.min(255, cfg.textAlphaThreshold));

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const i = (y * canvas.width + x) * 4;
      if (data[i + 3] >= alphaMin) points.push({ x, y });
    }
  }

  if (!points.length) return [];

  const sx = width / canvas.width;
  const sy = height / canvas.height;
  const s = Math.min(sx, sy) * cfg.textScale;

  const toScene = (p) => {
    const nx = (p.x - canvas.width / 2) * s + cfg.textOffsetX;
    const ny = (canvas.height / 2 - p.y) * s + cfg.textOffsetY;
    return new THREE.Vector3(nx, ny, cfg.textOffsetZ);
  };

  const shuffled = points
    .map((p) => ({ p, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.p);

  const out = new Array(targetCount);
  for (let i = 0; i < targetCount; i += 1) out[i] = toScene(shuffled[i % shuffled.length]);
  return out;
};

const buildSpherePoints = (count, radius, cfg) => {
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);

    const r = radius * (
      cfg.sphereRadiusMin + Math.random() * (cfg.sphereRadiusMax - cfg.sphereRadiusMin)
    );

    const sinPhi = Math.sin(phi);

    out[i] = new THREE.Vector3(
      r * sinPhi * Math.cos(theta),
      r * sinPhi * Math.sin(theta),
      r * Math.cos(phi),
    );
  }
  return out;
};

const buildDiskPoints = (count, radius, cfg) => {
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    out[i] = new THREE.Vector3(
      Math.cos(a) * r,
      Math.sin(a) * r,
      (Math.random() - 0.5) * cfg.diskDepth,
    );
  }
  return out;
};

const buildRingPoints = (count, radius, cfg) => {
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = radius * (cfg.ringInner + Math.random() * (cfg.ringOuter - cfg.ringInner));
    out[i] = new THREE.Vector3(
      Math.cos(a) * r,
      Math.sin(a) * r,
      (Math.random() - 0.5) * cfg.ringDepth,
    );
  }
  return out;
};

const buildCirclePoints = (count, radius, cfg) => {
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    out[i] = new THREE.Vector3(
      Math.cos(a) * radius + cfg.circleOffsetX,
      Math.sin(a) * radius + cfg.circleOffsetY,
      cfg.circleOffsetZ,
    );
  }
  return out;
};

const safeDispose = (renderer, geometry, material) => {
  if (geometry) geometry.dispose();
  if (material) material.dispose();
  if (renderer) renderer.dispose();
};

export const defaultParticlesConfig = {
  enabled: true,

  loopMode: 'once',
  pauseWhenHidden: true,
  ambientAfterIntro: false,

  debugLoop: false,
  debugMorph: 1,
  debugFadeOut: 0,

  particleCount: 1800,
  particleCountSmall: 2200,
  particleCountLarge: 1500,

  dprCap: 5 / 4,
  dprCapSmall: 5 / 4,
  dprCapLarge: 1.5,

  colorMode: 'cssVar',
  colorCssVar: '--color-accent',
  colorFallback: '#ffffff',

  maxOpacity: 3 / 4,
  pointSize: 1.6,
  pointSizeSmall: 1.6,
  pointSizeLarge: 2.1,
  sizeAttenuation: true,

  blending: 'normal',

  fadeInMs: 520,
  morphMs: 1400,
  holdMs: 520,
  fadeOutMs: 740,

  easing: 'inOutCubic',

  rotationSpeedXSmall: 6e-4,
  rotationSpeedYSmall: 1.2e-3,
  rotationSpeedXLarge: 8e-4,
  rotationSpeedYLarge: 1.6e-3,

  driftStrength: 22,

  startShape: 'sphere',
  startRadiusFactor: 7 / 25,

  sphereRadiusMin: 23 / 25,
  sphereRadiusMax: 1.0,

  diskDepth: 14,

  ringInner: 39 / 50,
  ringOuter: 1.0,
  ringDepth: 18,

  targetShape: 'text',

  textSelector: '',
  textOverride: '',
  textFallback: 'Cosmic Inventory',

  textCanvasW: 640,
  textCanvasH: 260,
  textFontWeight: 600,
  textFontFamily: 'Audiowide, Segoe UI, Tahoma, Arial, sans-serif',
  textBaseFontSize: 120,
  textMinFontSize: 54,
  textMaxWidthFactor: 0.9,

  textSampleStep: 2,
  textAlphaThreshold: 140,
  textScale: 11 / 20,

  textOffsetX: 0,
  textOffsetY: 0,
  textOffsetZ: 0,

  circleRadiusFactor: 11 / 50,
  circleOffsetX: 0,
  circleOffsetY: 0,
  circleOffsetZ: 0,

  cameraFov: 10055,
  cameraZ: 520,

  fpsCap: 30,
};

export const createParticlesEngine = (host, userConfig = {}) => {
  const doc = host?.ownerDocument || null;
  const view = doc?.defaultView || null;
  if (!doc || !view) return null;

  const prefersReducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return null;

  const cfg = { ...defaultParticlesConfig, ...userConfig };
  const isMobile = view.matchMedia('(max-width: 899px)').matches;
  if (!cfg.enabled) return null;

  const rect = host.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);

  const {
    dprCap: dprCapConfig,
    dprCapSmall,
    dprCapLarge,
  } = cfg;
  let dprCap = dprCapLarge;
  if (typeof dprCapConfig === 'number') dprCap = dprCapConfig;
  else if (isMobile) dprCap = dprCapSmall;
  const { devicePixelRatio = 1 } = view;
  const dpr = Math.min(devicePixelRatio, dprCap);

  let count = cfg.particleCountLarge;
  if (typeof cfg.particleCount === 'number') count = cfg.particleCount;
  else if (isMobile) count = cfg.particleCountSmall;
  const Float32 = view.Float32Array || Array;
  const noisePhase = new Float32(count);

  for (let i = 0; i < count; i += 1) noisePhase[i] = Math.random() * Math.PI * 2;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });

  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);

  const canvas = renderer.domElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';
  host.appendChild(canvas);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(cfg.cameraFov, w / h, 0.1, 2000);
  camera.position.z = cfg.cameraZ;

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32(count * 3);

  const radius = Math.min(w, h) * cfg.startRadiusFactor;

  const makeStart = () => {
    if (cfg.startShape === 'disk') return buildDiskPoints(count, radius, cfg);
    if (cfg.startShape === 'ring') return buildRingPoints(count, radius, cfg);
    return buildSpherePoints(count, radius, cfg);
  };

  const makeTarget = () => {
    if (cfg.targetShape === 'circle') {
      const r = Math.min(w, h) * cfg.circleRadiusFactor;
      return buildCirclePoints(count, r, cfg);
    }

    if (cfg.targetShape === 'sphere') return buildSpherePoints(count, radius, cfg);
    if (cfg.targetShape === 'disk') return buildDiskPoints(count, radius, cfg);
    if (cfg.targetShape === 'ring') return buildRingPoints(count, radius, cfg);

    const text = pickText(cfg, doc);
    return buildTextPoints(text, w, h, count, cfg, doc);
  };

  let start = makeStart();
  let target = makeTarget();

  for (let i = 0; i < count; i += 1) {
    positions[i * 3 + 0] = start[i].x;
    positions[i * 3 + 1] = start[i].y;
    positions[i * 3 + 2] = start[i].z;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const particleColorCss = cfg.colorMode === 'cssVar'
    ? getCssVarColor(doc, view, cfg.colorCssVar, cfg.colorFallback)
    : cfg.colorFallback;

  let basePointSize = cfg.pointSizeLarge;
  if (typeof cfg.pointSize === 'number') basePointSize = cfg.pointSize;
  else if (isMobile) basePointSize = cfg.pointSizeSmall;

  const material = new THREE.PointsMaterial({
    color: new THREE.Color(particleColorCss),
    size: basePointSize,
    sizeAttenuation: cfg.sizeAttenuation,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: cfg.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let rafId = 0;
  let startTs = 0;
  let lastTs = 0;
  let render = null;
  let isDestroyed = false;

  const minFrameMs = cfg.fpsCap > 0 ? 1000 / cfg.fpsCap : 0;
  const ease = easings[cfg.easing] || easings.inOutCubic;

  const onResize = () => {
    const r = host.getBoundingClientRect();
    const nw = Math.max(1, r.width);
    const nh = Math.max(1, r.height);

    renderer.setSize(nw, nh, false);
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
  };

  const onVisibility = () => {
    if (!cfg.pauseWhenHidden || isDestroyed) return;
    if (doc && doc.hidden) {
      if (rafId) view.cancelAnimationFrame(rafId);
      rafId = 0;
      return;
    }

    if (!rafId && render) {
      startTs = 0;
      lastTs = 0;
      rafId = view.requestAnimationFrame(render);
    }
  };

  const onWindowBlur = () => {
    if (!cfg.pauseWhenHidden || isDestroyed) return;
    if (rafId) view.cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const onWindowFocus = () => {
    if (!cfg.pauseWhenHidden || isDestroyed) return;
    if (doc && doc.hidden) return;
    if (!rafId && render) {
      startTs = 0;
      lastTs = 0;
      rafId = view.requestAnimationFrame(render);
    }
  };

  const onPageHide = () => {
    if (!cfg.pauseWhenHidden || isDestroyed) return;
    if (rafId) view.cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const onPageShow = () => {
    if (!cfg.pauseWhenHidden || isDestroyed) return;
    if (doc && doc.hidden) return;
    if (!rafId && render) {
      startTs = 0;
      lastTs = 0;
      rafId = view.requestAnimationFrame(render);
    }
  };

  const totalMs = () => cfg.fadeInMs + cfg.morphMs + cfg.holdMs + cfg.fadeOutMs;

  const destroy = () => {
    isDestroyed = true;
    view.cancelAnimationFrame(rafId);
    rafId = 0;
    view.removeEventListener('resize', onResize);
    if (doc) doc.removeEventListener('visibilitychange', onVisibility);
    view.removeEventListener('blur', onWindowBlur);
    view.removeEventListener('focus', onWindowFocus);
    view.removeEventListener('pagehide', onPageHide);
    view.removeEventListener('pageshow', onPageShow);

    try {
      scene.remove(points);
    } catch (_error) {
      // Scene may already be detached.
    }

    safeDispose(renderer, geometry, material);

    if (canvas && canvas.parentNode === host) host.removeChild(canvas);
  };

  render = (ts) => {
    if (isDestroyed) return;
    if (!startTs) startTs = ts;

    if (minFrameMs > 0) {
      if (lastTs && ts - lastTs < minFrameMs) {
        rafId = view.requestAnimationFrame(render);
        return;
      }
      lastTs = ts;
    }

    const elapsed = ts - startTs;

    let tFadeIn = 1;
    let tMorph = 1;
    let tFadeOut = 0;

    const mode = cfg.debugLoop ? 'debug' : cfg.loopMode;

    if (mode === 'debug') {
      tFadeIn = 1;
      tMorph = clamp01(cfg.debugMorph);
      tFadeOut = clamp01(cfg.debugFadeOut);
    } else if (mode === 'repeat') {
      const tm = totalMs();
      const e = tm > 0 ? elapsed % tm : elapsed;

      tFadeIn = clamp01(e / Math.max(1, cfg.fadeInMs));
      tMorph = clamp01((e - cfg.fadeInMs) / Math.max(1, cfg.morphMs));
      tFadeOut = clamp01(
        (e - cfg.fadeInMs - cfg.morphMs - cfg.holdMs) / Math.max(1, cfg.fadeOutMs),
      );
    } else if (mode === 'continuous') {
      const inDone = clamp01(elapsed / Math.max(1, cfg.fadeInMs));
      const morphDone = clamp01((elapsed - cfg.fadeInMs) / Math.max(1, cfg.morphMs));

      tFadeIn = inDone;
      tMorph = morphDone;
      tFadeOut = 0;
    } else {
      tFadeIn = clamp01(elapsed / Math.max(1, cfg.fadeInMs));
      tMorph = clamp01((elapsed - cfg.fadeInMs) / Math.max(1, cfg.morphMs));
      tFadeOut = clamp01(
        (elapsed - cfg.fadeInMs - cfg.morphMs - cfg.holdMs) / Math.max(1, cfg.fadeOutMs),
      );
    }

    if (cfg.ambientAfterIntro && mode === 'once' && elapsed >= totalMs()) {
      tFadeIn = 1;
      tMorph = 1;
      tFadeOut = 0;
    }

    material.opacity = cfg.maxOpacity * tFadeIn * (1 - tFadeOut);

    const mix = ease(tMorph);

    const posAttr = geometry.getAttribute('position');
    const arr = posAttr.array;

    const drift = tFadeOut * cfg.driftStrength;

    for (let i = 0; i < count; i += 1) {
      const a = start[i];
      const b = target[i];

      const x = a.x + (b.x - a.x) * mix;
      const y = a.y + (b.y - a.y) * mix;
      const z = a.z + (b.z - a.z) * mix;

      const n = Math.sin(ts * 1e-3 + noisePhase[i]) * drift;

      arr[i * 3 + 0] = x + n;
      arr[i * 3 + 1] = y + n;
      arr[i * 3 + 2] = z + n;
    }

    posAttr.needsUpdate = true;

    const rotX = isMobile ? cfg.rotationSpeedXSmall : cfg.rotationSpeedXLarge;
    const rotY = isMobile ? cfg.rotationSpeedYSmall : cfg.rotationSpeedYLarge;

    points.rotation.y += rotY;
    points.rotation.x += rotX;

    renderer.render(scene, camera);

    if (mode === 'once' && !cfg.ambientAfterIntro) {
      if (elapsed >= totalMs()) {
        destroy();
        return;
      }
    }

    rafId = view.requestAnimationFrame(render);
  };

  const startEngine = () => {
    view.addEventListener('resize', onResize);
    if (doc) doc.addEventListener('visibilitychange', onVisibility);
    view.addEventListener('blur', onWindowBlur);
    view.addEventListener('focus', onWindowFocus);
    view.addEventListener('pagehide', onPageHide);
    view.addEventListener('pageshow', onPageShow);

    if (cfg.pauseWhenHidden && doc && doc.hidden) {
      rafId = 0;
      return;
    }

    rafId = view.requestAnimationFrame(render);
  };

  const pause = () => {
    if (isDestroyed) return;
    if (rafId) view.cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const resume = () => {
    if (isDestroyed) return;
    if (cfg.pauseWhenHidden && doc && doc.hidden) return;
    if (!rafId && render) {
      startTs = 0;
      lastTs = 0;
      rafId = view.requestAnimationFrame(render);
    }
  };

  return {
    start: startEngine,
    pause,
    resume,
    destroy,
  };
};

export const loadPresetJson = async (url, fetchImpl) => {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch API unavailable');
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error('Preset load failed');
  return res.json();
};
