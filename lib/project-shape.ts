export type Rect = { l: number; t: number; r: number; b: number };

export const shapeHalo = 12;
export const outerRadius = 16;
export const innerRadius = 12;

type Point = { x: number; y: number };
type Segment = { x1: number; y1: number; x2: number; y2: number };

function uniqueSorted(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const result: number[] = [];

  for (const value of sorted) {
    if (!result.length || value - result[result.length - 1] > 0.5) {
      result.push(value);
    }
  }

  return result;
}

function snapRects(rects: Rect[]) {
  const xs = uniqueSorted(rects.flatMap((rect) => [rect.l, rect.r]));
  const ys = uniqueSorted(rects.flatMap((rect) => [rect.t, rect.b]));
  const snap = (value: number, axis: number[]) =>
    axis.reduce((closest, candidate) =>
      Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest,
    );

  return rects.map((rect) => ({
    l: snap(rect.l, xs),
    t: snap(rect.t, ys),
    r: snap(rect.r, xs),
    b: snap(rect.b, ys),
  }));
}

function contains(rects: Rect[], x: number, y: number) {
  return rects.some(
    (rect) => x > rect.l && x < rect.r && y > rect.t && y < rect.b,
  );
}

function boundarySegments(rects: Rect[]) {
  const xs = uniqueSorted(rects.flatMap((rect) => [rect.l, rect.r]));
  const ys = uniqueSorted(rects.flatMap((rect) => [rect.t, rect.b]));
  const segments: Segment[] = [];

  for (const y of ys) {
    for (let index = 0; index < xs.length - 1; index++) {
      const x1 = xs[index];
      const x2 = xs[index + 1];
      const mid = (x1 + x2) / 2;
      const above = contains(rects, mid, y - 0.25);
      const below = contains(rects, mid, y + 0.25);

      if (below && !above) segments.push({ x1, y1: y, x2, y2: y });
      if (above && !below) segments.push({ x1: x2, y1: y, x2: x1, y2: y });
    }
  }

  for (const x of xs) {
    for (let index = 0; index < ys.length - 1; index++) {
      const y1 = ys[index];
      const y2 = ys[index + 1];
      const mid = (y1 + y2) / 2;
      const left = contains(rects, x - 0.25, mid);
      const right = contains(rects, x + 0.25, mid);

      if (left && !right) segments.push({ x1: x, y1, x2: x, y2 });
      if (right && !left) segments.push({ x1: x, y1: y2, x2: x, y2: y1 });
    }
  }

  return segments;
}

function stitch(segments: Segment[]) {
  const used = new Array(segments.length).fill(false);
  const loops: Point[][] = [];

  for (let index = 0; index < segments.length; index++) {
    if (used[index]) continue;
    used[index] = true;

    const start = segments[index];
    const points: Point[] = [{ x: start.x1, y: start.y1 }];
    let current = start;
    let closed = false;

    for (let step = 0; step < segments.length; step++) {
      const nextIndex = segments.findIndex(
        (segment, segmentIndex) =>
          !used[segmentIndex] &&
          Math.abs(segment.x1 - current.x2) < 0.6 &&
          Math.abs(segment.y1 - current.y2) < 0.6,
      );

      if (nextIndex === -1) {
        closed =
          Math.abs(current.x2 - start.x1) < 0.6 &&
          Math.abs(current.y2 - start.y1) < 0.6;
        break;
      }

      used[nextIndex] = true;
      points.push({ x: segments[nextIndex].x1, y: segments[nextIndex].y1 });
      current = segments[nextIndex];

      if (
        Math.abs(current.x2 - start.x1) < 0.6 &&
        Math.abs(current.y2 - start.y1) < 0.6
      ) {
        closed = true;
        break;
      }
    }

    if (closed && points.length >= 4) loops.push(points);
  }

  return loops;
}

function roundLoop(points: Point[], outer: number, inner: number) {
  const corners = points.filter((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const cross =
      (point.x - previous.x) * (next.y - point.y) -
      (point.y - previous.y) * (next.x - point.x);
    return Math.abs(cross) > 0.1;
  });

  const format = (value: number) => value.toFixed(1);
  const commands: string[] = [];

  for (let index = 0; index < corners.length; index++) {
    const previous = corners[(index - 1 + corners.length) % corners.length];
    const current = corners[index];
    const next = corners[(index + 1) % corners.length];
    const incoming = { x: current.x - previous.x, y: current.y - previous.y };
    const outgoing = { x: next.x - current.x, y: next.y - current.y };
    const incomingLength = Math.hypot(incoming.x, incoming.y);
    const outgoingLength = Math.hypot(outgoing.x, outgoing.y);
    if (incomingLength < 0.5 || outgoingLength < 0.5) continue;

    const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
    const trim = Math.min(
      cross > 0 ? outer : inner,
      incomingLength / 2,
      outgoingLength / 2,
    );

    if (trim < 0.5) {
      commands.push(
        `${commands.length ? "L" : "M"} ${format(current.x)} ${format(current.y)}`,
      );
      continue;
    }

    const incomingUnit = {
      x: incoming.x / incomingLength,
      y: incoming.y / incomingLength,
    };
    const outgoingUnit = {
      x: outgoing.x / outgoingLength,
      y: outgoing.y / outgoingLength,
    };
    const start = {
      x: current.x - incomingUnit.x * trim,
      y: current.y - incomingUnit.y * trim,
    };
    const end = {
      x: current.x + outgoingUnit.x * trim,
      y: current.y + outgoingUnit.y * trim,
    };

    commands.push(
      `${commands.length ? "L" : "M"} ${format(start.x)} ${format(start.y)}`,
    );
    commands.push(
      `A ${format(trim)} ${format(trim)} 0 0 ${cross > 0 ? 1 : 0} ${format(end.x)} ${format(end.y)}`,
    );
  }

  if (!commands.length) return "";
  commands.push("Z");
  return commands.join(" ");
}

export function unionPath(
  rects: Rect[],
  outer = outerRadius,
  inner = innerRadius,
) {
  if (!rects.length) return "";

  return stitch(boundarySegments(snapRects(rects)))
    .map((loop) => roundLoop(loop, outer, inner))
    .filter(Boolean)
    .join(" ");
}

export function rectsTouch(a: Rect, b: Rect) {
  const verticalOverlap = Math.min(a.b, b.b) - Math.max(a.t, b.t);
  const horizontalOverlap = Math.min(a.r, b.r) - Math.max(a.l, b.l);
  const gapX = Math.max(a.l, b.l) - Math.min(a.r, b.r);
  const gapY = Math.max(a.t, b.t) - Math.min(a.b, b.b);

  return (
    (gapX >= -4 && gapX <= 56 && verticalOverlap > 12) ||
    (gapY >= -4 && gapY <= 56 && horizontalOverlap > 12)
  );
}

export function expandRect(rect: Rect, halo = shapeHalo): Rect {
  return {
    l: rect.l - halo,
    t: rect.t - halo,
    r: rect.r + halo,
    b: rect.b + halo,
  };
}

export function restScaleFor(rects: Rect[]) {
  const left = Math.min(...rects.map((rect) => rect.l));
  const top = Math.min(...rects.map((rect) => rect.t));
  const right = Math.max(...rects.map((rect) => rect.r));
  const bottom = Math.max(...rects.map((rect) => rect.b));
  const span = Math.max(right - left, bottom - top);
  if (span <= shapeHalo * 2) return 0.9;
  return Math.max(0.9, 1 - (shapeHalo * 2) / span);
}
