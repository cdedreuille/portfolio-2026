export const W = 960;
export const H = 420;
export const GROUND = 268;
export const TOTAL = 10;
export const NEEDED = 4;
export const SPAWN_EVERY = 70;
export const WALK_SPEED = 0.7;
export const FALL_SPEED = 1.8;
export const BODY_W = 5;
export const BODY_H = 13;

export const SKILL_USES = {
  blocker: 1,
  digger: 1,
  builder: 2,
} as const;

export type Skill = keyof typeof SKILL_USES;
export type Job = "walk" | "fall" | "blocker" | "digger" | "builder";

export type Walker = {
  x: number;
  y: number;
  dir: 1 | -1;
  job: Job;
  phase: number;
  digLeft: number;
  buildLeft: number;
  saved: boolean;
  dead: boolean;
};

export type World = {
  terrain: Uint8Array;
  walkers: Walker[];
  spawned: number;
  spawnTimer: number;
  frame: number;
  outCount: number;
  deadCount: number;
  result: "playing" | "won" | "lost";
  uses: Record<Skill, number>;
};

function idx(x: number, y: number) {
  return y * W + x;
}

export function inBounds(x: number, y: number) {
  return x >= 0 && y >= 0 && x < W && y < H;
}

export function solidAt(terrain: Uint8Array, x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (!inBounds(ix, iy)) return false;
  return terrain[idx(ix, iy)] === 1;
}

export function fillRect(
  terrain: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value: 0 | 1,
) {
  const xa = Math.max(0, Math.min(W, Math.floor(Math.min(x0, x1))));
  const xb = Math.max(0, Math.min(W, Math.ceil(Math.max(x0, x1))));
  const ya = Math.max(0, Math.min(H, Math.floor(Math.min(y0, y1))));
  const yb = Math.max(0, Math.min(H, Math.ceil(Math.max(y0, y1))));
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      terrain[idx(x, y)] = value;
    }
  }
}

export function createTerrain() {
  const terrain = new Uint8Array(W * H);
  fillRect(terrain, 52, GROUND, 328, H, 1);
  fillRect(terrain, 278, GROUND - 96, 318, GROUND, 1);
  fillRect(terrain, 448, GROUND, W, H, 1);
  return terrain;
}

export function createWorld(): World {
  return {
    terrain: createTerrain(),
    walkers: [],
    spawned: 0,
    spawnTimer: 20,
    frame: 0,
    outCount: 0,
    deadCount: 0,
    result: "playing",
    uses: { ...SKILL_USES },
  };
}

export function grounded(terrain: Uint8Array, x: number, y: number) {
  return (
    solidAt(terrain, x, y + 1) ||
    solidAt(terrain, x - 2, y + 1) ||
    solidAt(terrain, x + 2, y + 1)
  );
}

function wallAhead(terrain: Uint8Array, w: Walker) {
  const nx = w.x + w.dir * (BODY_W + 1);
  for (let i = 3; i < BODY_H; i++) {
    if (solidAt(terrain, nx, w.y - i)) return true;
  }
  return false;
}

export function unstick(terrain: Uint8Array, w: Walker) {
  let guard = 0;
  while (guard++ < 20 && solidAt(terrain, w.x, w.y)) {
    w.y -= 1;
  }
}

function stepUp(terrain: Uint8Array, w: Walker) {
  const nx = w.x + w.dir * (BODY_W + 1);
  if (!solidAt(terrain, nx, w.y - 1)) return false;
  if (solidAt(terrain, nx, w.y - 6)) return false;
  w.y -= 4;
  unstick(terrain, w);
  return true;
}

function hitBlocker(walkers: Walker[], w: Walker) {
  for (const other of walkers) {
    if (other === w || other.dead || other.saved || other.job !== "blocker") {
      continue;
    }
    if (Math.abs(other.y - w.y) > 10) continue;
    const dx = other.x - w.x;
    if (dx * w.dir > 0 && Math.abs(dx) < 12) return true;
  }
  return false;
}

export function inDoor(w: Walker) {
  return w.x > 878 && w.x < 930 && w.y > GROUND - 64 && w.y <= GROUND + 2;
}

export function spawnWalker(world: World) {
  world.walkers.push({
    x: 108,
    y: GROUND,
    dir: 1,
    job: "walk",
    phase: Math.random() * 10,
    digLeft: 0,
    buildLeft: 0,
    saved: false,
    dead: false,
  });
  world.spawned += 1;
}

export function assignJob(world: World, walker: Walker, skill: Skill) {
  if (walker.dead || walker.saved) return false;
  if (walker.job === "blocker" || walker.job === "digger" || walker.job === "builder") {
    return false;
  }
  if (walker.job === "fall") return false;
  if (world.uses[skill] <= 0) return false;
  if (skill === "blocker") {
    walker.job = "blocker";
  } else if (skill === "digger") {
    walker.job = "digger";
    walker.digLeft = 90;
  } else {
    walker.job = "builder";
    walker.buildLeft = 18;
  }
  world.uses[skill] -= 1;
  return true;
}

export function walkerAt(world: World, x: number, y: number, radius = 18) {
  let best: Walker | null = null;
  let bestDist = radius;
  for (const w of world.walkers) {
    if (w.saved || w.dead) continue;
    const d = Math.hypot(w.x - x, w.y - 8 - y);
    if (d < bestDist) {
      best = w;
      bestDist = d;
    }
  }
  return best;
}

function tickWalker(world: World, w: Walker) {
  if (w.saved || w.dead) return;
  const { terrain, walkers } = world;

  if (w.y > H + 8) {
    w.dead = true;
    world.deadCount += 1;
    return;
  }

  if (inDoor(w) && w.job !== "blocker") {
    w.saved = true;
    world.outCount += 1;
    return;
  }

  if (w.job === "blocker") return;

  if (w.job === "digger" && w.digLeft > 0) {
    const x0 = w.x - 1;
    const x1 = w.x + w.dir * 14;
    fillRect(terrain, x0, w.y - BODY_H - 2, x1, w.y, 0);
    w.x += w.dir * 0.55;
    w.digLeft -= 1;
    if (!grounded(terrain, w.x, w.y)) {
      w.job = "fall";
      w.digLeft = 0;
    } else if (w.digLeft <= 0) {
      w.job = "walk";
    }
    return;
  }

  if (w.job === "builder" && w.buildLeft > 0) {
    if (world.frame % 7 === 0) {
      const y0 = Math.floor(w.y) + 1;
      const bx = w.x + w.dir * 4;
      fillRect(terrain, bx, y0, bx + w.dir * 12, y0 + 5, 1);
      w.x += w.dir * 8;
      w.buildLeft -= 1;
    }
    if (!grounded(terrain, w.x, w.y)) {
      w.job = "fall";
    } else if (w.buildLeft <= 0) {
      w.job = "walk";
    }
    return;
  }

  if (!grounded(terrain, w.x, w.y)) {
    w.job = "fall";
    w.y += FALL_SPEED;
    return;
  }

  w.job = "walk";
  unstick(terrain, w);

  if (hitBlocker(walkers, w) || (!stepUp(terrain, w) && wallAhead(terrain, w))) {
    w.dir = w.dir === 1 ? -1 : 1;
    return;
  }

  w.x += w.dir * WALK_SPEED;
}

export function tickWorld(world: World) {
  world.frame += 1;

  if (world.result === "playing") {
    world.spawnTimer -= 1;
    if (world.spawned < TOTAL && world.spawnTimer <= 0) {
      spawnWalker(world);
      world.spawnTimer = SPAWN_EVERY;
    }
  }

  for (const w of world.walkers) tickWalker(world, w);

  if (world.result !== "playing") return;

  const active = world.walkers.some((w) => !w.saved && !w.dead);
  if (world.outCount >= NEEDED) world.result = "won";
  else if (world.deadCount > TOTAL - NEEDED) world.result = "lost";
  else if (world.spawned >= TOTAL && !active && world.outCount < NEEDED) {
    world.result = "lost";
  }
}
