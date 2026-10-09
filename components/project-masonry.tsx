"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { MasonryVideo } from "@/components/masonry-video";
import {
  expandRect,
  restScaleFor,
  rectsTouch,
  unionPath,
  type Rect,
} from "@/lib/project-shape";
import { isVideo, type GridTile } from "@/lib/projects";

const columnCount = 3;
const imageSizes = "(min-width: 1200px) 400px, 33vw";

function Tile({ tile }: { tile: GridTile }) {
  if (!isVideo(tile.src)) {
    return (
      <Image
        src={tile.src}
        alt={tile.projectName}
        width={tile.width}
        height={tile.height}
        sizes={imageSizes}
        style={{ width: "100%", height: "auto" }}
      />
    );
  }

  return (
    <MasonryVideo
      src={tile.src}
      width={tile.width}
      height={tile.height}
      label={tile.projectName}
    />
  );
}

type ProjectShape = {
  key: string;
  project: string;
  color: string;
  d: string;
  restScale: string;
};

type MeasuredTile = {
  project: string;
  color: string;
  rect: Rect;
};

function connectedGroups(tiles: MeasuredTile[]) {
  const pending = new Set(tiles);
  const groups: MeasuredTile[][] = [];

  for (const tile of tiles) {
    if (!pending.has(tile)) continue;
    pending.delete(tile);

    const group = [tile];
    const queue = [tile];

    while (queue.length) {
      const current = queue.pop();
      if (!current) break;

      for (const other of [...pending]) {
        if (!rectsTouch(current.rect, other.rect)) continue;
        pending.delete(other);
        group.push(other);
        queue.push(other);
      }
    }

    groups.push(group);
  }

  return groups;
}

function measureShapes(root: HTMLElement): {
  width: number;
  height: number;
  shapes: ProjectShape[];
} {
  const rootRect = root.getBoundingClientRect();
  const tiles: MeasuredTile[] = [
    ...root.querySelectorAll<HTMLElement>("li[data-tile]"),
  ].map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      project: element.dataset.project ?? "",
      color: element.dataset.color ?? "",
      rect: {
        l: rect.left - rootRect.left,
        t: rect.top - rootRect.top,
        r: rect.right - rootRect.left,
        b: rect.bottom - rootRect.top,
      },
    };
  });

  const byProject = new Map<string, MeasuredTile[]>();
  for (const tile of tiles) {
    const group = byProject.get(tile.project) ?? [];
    group.push(tile);
    byProject.set(tile.project, group);
  }

  const shapes: ProjectShape[] = [];

  for (const [project, projectTiles] of byProject) {
    connectedGroups(projectTiles).forEach((group, index) => {
      const expanded = group.map((tile) => expandRect(tile.rect));
      const d = unionPath(expanded);
      if (!d) return;

      shapes.push({
        key: `${project}:${index}`,
        project,
        color: group[0].color,
        d,
        restScale: restScaleFor(expanded).toFixed(3),
      });
    });
  }

  return {
    width: rootRect.width,
    height: rootRect.height,
    shapes,
  };
}

export function ProjectMasonry({ tiles }: { tiles: GridTile[] }) {
  const masonryRef = useRef<HTMLDivElement>(null);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [board, setBoard] = useState({ width: 0, height: 0, shapes: [] as ProjectShape[] });
  const columns = Array.from({ length: columnCount }, (_, column) =>
    tiles.filter((_, index) => index % columnCount === column),
  );

  useLayoutEffect(() => {
    const root = masonryRef.current;
    if (!root) return;

    const update = () => setBoard(measureShapes(root));
    update();

    const observer = new ResizeObserver(update);
    observer.observe(root);
    for (const tile of root.querySelectorAll("li[data-tile]")) {
      observer.observe(tile);
    }

    return () => observer.disconnect();
  }, [tiles]);

  return (
    <div
      ref={masonryRef}
      className="masonry"
      onMouseLeave={() => setActiveProject(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setActiveProject(null);
        }
      }}
    >
      {board.width > 0 && (
        <svg
          className="project-shape"
          viewBox={`0 0 ${board.width} ${board.height}`}
          aria-hidden="true"
        >
          {board.shapes.map((shape) => (
            <path
              key={shape.key}
              d={shape.d}
              fill={shape.color}
              data-active={activeProject === shape.project || undefined}
              style={{ "--rest-scale": shape.restScale } as CSSProperties}
            />
          ))}
        </svg>
      )}
      {columns.map((column, columnIndex) => (
        <ul key={columnIndex}>
          {column.map((tile) => (
            <li
              key={tile.id}
              data-tile={tile.id}
              data-project={tile.projectSlug}
              data-color={tile.projectColor}
              tabIndex={0}
              onMouseEnter={() => setActiveProject(tile.projectSlug)}
              onMouseLeave={() => setActiveProject(null)}
              onFocus={() => setActiveProject(tile.projectSlug)}
            >
              <Tile tile={tile} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
