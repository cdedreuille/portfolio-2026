import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type AdminAsset = {
  src: string;
  width?: number;
  height?: number;
  selected: boolean;
  type: "image" | "video";
};

export type AdminProject = {
  name: string;
  slug: string;
  date: string;
  description: string;
  color: string;
  assets: AdminAsset[];
};

type ProjectFile = {
  name: string;
  slug: string;
  date?: string;
  description?: string;
  color: string;
  grid: {
    src: string;
    width: number;
    height: number;
  }[];
};

const imageExtensions = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);

function assetType(src: string): AdminAsset["type"] {
  return src.split("?")[0]?.endsWith(".mp4") ? "video" : "image";
}

function isLogo(filename: string) {
  return path.basename(filename).startsWith("logo.");
}

export async function getAdminProjects(): Promise<AdminProject[]> {
  const root = process.cwd();
  const contentDirectory = path.join(root, "content");
  const filenames = (await readdir(contentDirectory))
    .filter((filename) => filename.endsWith(".json"))
    .sort();

  const projects = await Promise.all(
    filenames.map(async (filename) => {
      const project = JSON.parse(
        await readFile(path.join(contentDirectory, filename), "utf8"),
      ) as ProjectFile;
      const selected = new Map(project.grid.map((asset) => [asset.src, asset]));
      const publicDirectory = path.join(root, "public", project.slug);
      const publicFiles = (await readdir(publicDirectory))
        .filter(
          (asset) =>
            imageExtensions.has(path.extname(asset).toLowerCase()) &&
            !isLogo(asset),
        )
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const localAssets = publicFiles.map((asset) => {
        const src = `/${project.slug}/${asset}`;
        const dimensions = selected.get(src);

        return {
          src,
          width: dimensions?.width,
          height: dimensions?.height,
          selected: selected.has(src),
          type: "image" as const,
        };
      });
      const localSources = new Set(localAssets.map((asset) => asset.src));
      const remoteAssets = project.grid
        .filter((asset) => !localSources.has(asset.src) && !isLogo(asset.src))
        .map((asset) => ({
          ...asset,
          selected: true,
          type: assetType(asset.src),
        }));

      return {
        name: project.name,
        slug: project.slug,
        date: project.date ?? "",
        description: project.description ?? "",
        color: project.color,
        assets: [...localAssets, ...remoteAssets],
      };
    }),
  );

  return projects.sort(
    (a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name),
  );
}
