/**
 * Little Acre — locked pastel palette. Pull every colour used by the board renderer
 * from here; do not hardcode hex elsewhere (mirror the palette discipline from the
 * reference project). Values are lifted from the `Farm Idle.dc.html` prototype so the
 * rendered board matches the target thumbnail.
 */

/** Page backdrop gradient stops (sky → meadow → sand). Also mirrored in globals.css. */
export const SKY = {
  top: '#d8edf2',
  mid: '#e7f2e4',
  bottom: '#fbeecb',
} as const;

/** Warm sun glow radial highlight. */
export const SUN_GLOW = 'rgba(255,248,215,.5)';

/** Ambient drifting pollen mote colour (alpha applied at draw time). */
export const POLLEN = '255,244,200';

/** The pinkish soil "cube" sides under every raised tile. */
export const TILE_SIDE = {
  right: '#a4677d',
  left: '#ba879b',
  edge: '#8f5468',
} as const;

/** Per-kind top-face colour ramps: [base, dark speckle, light speckle]. */
export const TILE_TOP = {
  grass: ['#9ccb6e', '#7cae4f', '#c2e39a'],
  tilledDry: ['#c69c6d', '#a67c50', '#dcbc90'],
  tilledWet: ['#a87f52', '#7f5c38', '#c39763'],
  pond: ['#8fd3e0', '#68bad0', '#c1ebf3'],
  rock: ['#b7ad93', '#988c6f', '#d2c9af'],
} as const;

export const FURROW = 'rgba(120,85,45,.16)';
export const HOVER_OUTLINE = 'rgba(255,255,255,.92)';

/** Crop stem / sparkle / water-droplet accents. */
export const CROP = {
  stem: '#5f9a3e',
  sprout: '#6cb04a',
  sparkle: '#fff6c8',
  droplet: '#6cc3de',
  wiltStem: '#9a8763',
  wiltLeaf: '#8a7a52',
} as const;

export const FLOWER = {
  petal: '#fffdf5',
  center: '#f7c948',
} as const;

export const POND = {
  ripple: 'rgba(255,255,255,.55)',
  fish: '#f0894a',
  fishEye: '#3a2a1a',
} as const;

export const ROCK = {
  a: '#9a9078',
  aTop: '#c1b89e',
  aBase: '#7d745e',
  b: '#8f8670',
  bTop: '#b3ab92',
  oreBlue: '#7fd3ff',
  oreGem: '#c9a6ff',
} as const;

export const SPRINKLER = {
  post: '#8a94a0',
  postBase: '#6b7480',
  head: '#aeb8c4',
  headTop: '#d6dde5',
  drop: '#6cc3de',
} as const;

export const SCARECROW = {
  post: '#9a6a3b',
  head: '#e0ba76',
  headTop: '#efd39a',
  eye: '#3a2a1a',
  body: '#c25b4a',
  bodyTop: '#d97a68',
  hat: '#b98a4a',
} as const;

/** Floating-number / coin fx colours. */
export const FX = {
  coin: '#f7c948',
  coinShine: '#fce9b0',
  coinText: '#f5a623',
  gainText: '#5a8f30',
  badText: '#d9563f',
  textStroke: 'rgba(255,255,255,.85)',
  splashLight: '#c6eef7',
} as const;
