"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GROUND,
  H,
  NEEDED,
  SKILL_USES,
  TOTAL,
  W,
  assignJob,
  createWorld,
  tickWorld,
  walkerAt,
  type Skill,
  type Walker,
  type World,
} from "./engine";
import styles from "./lemmings.module.css";

type Hud = {
  inCount: number;
  outCount: number;
  uses: Record<Skill, number>;
  result: World["result"];
};

const INITIAL_HUD: Hud = {
  inCount: 0,
  outCount: 0,
  uses: { ...SKILL_USES },
  result: "playing",
};

function drawTerrain(
  ctx: CanvasRenderingContext2D,
  image: ImageData,
  terrain: Uint8Array,
) {
  const data = image.data;
  for (let i = 0; i < terrain.length; i++) {
    const on = terrain[i] === 1;
    const p = i * 4;
    data[p] = on ? 0 : 255;
    data[p + 1] = on ? 0 : 255;
    data[p + 2] = on ? 0 : 255;
    data[p + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

function strokeHouse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  flip = false,
) {
  const dir = flip ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 38);
  ctx.lineTo(x + dir * 18, y - 56);
  ctx.lineTo(x + dir * 36, y - 38);
  ctx.lineTo(x + dir * 36, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x + dir * 12, y - 24, dir * 12, 24);
  ctx.stroke();
}

function drawWalker(ctx: CanvasRenderingContext2D, w: Walker, t: number) {
  const x = w.x;
  const y = w.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (w.job === "blocker") {
    ctx.beginPath();
    ctx.arc(0, -10, 4.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, -5);
    ctx.lineTo(5, -5);
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 0);
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const swing = w.job === "fall" ? 0 : Math.sin(t * 0.25 + w.phase) * 4;
  ctx.beginPath();
  ctx.arc(0, -11, 3.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(0, -1);
  ctx.moveTo(0, -5);
  ctx.lineTo(-4 * w.dir, -2);
  ctx.moveTo(0, -1);
  ctx.lineTo(-3 + swing * 0.15, 1);
  ctx.moveTo(0, -1);
  ctx.lineTo(3 - swing * 0.15, 1);
  ctx.stroke();

  if (w.job === "builder") {
    ctx.beginPath();
    ctx.rect(w.dir * 5, -8, w.dir * 6, 3);
    ctx.stroke();
  }
  ctx.restore();
}

export function LemmingsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [skill, setSkill] = useState<Skill>("blocker");
  const [runId, setRunId] = useState(0);
  const skillRef = useRef(skill);

  useEffect(() => {
    skillRef.current = skill;
  }, [skill]);

  const restart = useCallback(() => {
    setHud(INITIAL_HUD);
    setSkill("blocker");
    setRunId((n) => n + 1);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const world = createWorld();
    const image = ctx.createImageData(W, H);
    let raf = 0;
    let lastHud = "";

    const publish = () => {
      const next: Hud = {
        inCount: world.spawned,
        outCount: world.outCount,
        uses: { ...world.uses },
        result: world.result,
      };
      const key = JSON.stringify(next);
      if (key === lastHud) return;
      lastHud = key;
      setHud(next);
    };

    const draw = () => {
      drawTerrain(ctx, image, world.terrain);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.6;
      strokeHouse(ctx, 86, GROUND);
      strokeHouse(ctx, 902, GROUND, true);
      ctx.font = "20px Caveat, cursive";
      ctx.fillStyle = "#000";
      ctx.fillText("in", 92, GROUND - 64);
      ctx.fillText("out", 868, GROUND - 64);
      for (const w of world.walkers) {
        if (w.saved || w.dead) continue;
        drawWalker(ctx, w, world.frame);
      }
    };

    const loop = () => {
      tickWorld(world);
      draw();
      publish();
      raf = requestAnimationFrame(loop);
    };

    const onPointer = (event: PointerEvent) => {
      if (world.result !== "playing") return;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * W;
      const y = ((event.clientY - rect.top) / rect.height) * H;
      const target = walkerAt(world, x, y);
      if (!target) return;
      if (!assignJob(world, target, skillRef.current)) return;
      publish();
    };

    canvas.addEventListener("pointerdown", onPointer);
    publish();
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointer);
    };
  }, [runId]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Walkers</h1>
        <div className={styles.stats}>
          <span>
            in {hud.inCount}/{TOTAL}
          </span>
          <span>out {hud.outCount}</span>
          <span>need {NEEDED}</span>
          <button type="button" className={styles.restart} onClick={restart}>
            restart
          </button>
          <Link href="/" className={styles.homeLink}>
            home
          </Link>
        </div>
      </header>

      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={W}
          height={H}
        />
      </div>

      <div className={styles.skills}>
        {(Object.keys(SKILL_USES) as Skill[]).map((name) => (
          <button
            key={name}
            type="button"
            className={styles.skill}
            data-active={skill === name}
            disabled={hud.uses[name] <= 0}
            onClick={() => setSkill(name)}
          >
            {name} {hud.uses[name]}
          </button>
        ))}
      </div>

      <p className={styles.banner}>
        {hud.result === "won"
          ? "They made it."
          : hud.result === "lost"
            ? "Too many wandered off."
            : "Pick a skill, then tap a walker."}
      </p>
      <p className={styles.hint}>
        One will need to hold the left cliff. Another tunnels the wall. Two
        short bridges cover the gap.
      </p>
    </main>
  );
}
