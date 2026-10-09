import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

type GridAsset = {
  src: string;
  width: number;
  height: number;
};

type ProjectUpdate = {
  slug: string;
  name: string;
  date: string;
  description: string;
  color: string;
  grid: GridAsset[];
};

type ProjectFile = {
  name: string;
  slug: string;
  date: string;
  description: string;
  color: string;
  grid: GridAsset[];
};

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function isDate(value: string) {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isLogo(src: string) {
  return path.basename(src.split("?")[0] ?? src).startsWith("logo.");
}

function isValidAsset(slug: string, asset: GridAsset) {
  if (isLogo(asset.src)) return false;

  const isLocal = asset.src.startsWith(`/${slug}/`);
  const isBlobVideo = (() => {
    try {
      const url = new URL(asset.src);
      return (
        url.protocol === "https:" &&
        url.hostname.endsWith(".public.blob.vercel-storage.com") &&
        url.pathname.startsWith("/videos/") &&
        url.pathname.endsWith(".mp4")
      );
    } catch {
      return false;
    }
  })();

  return (
    (isLocal || isBlobVideo) &&
    Number.isFinite(asset.width) &&
    asset.width > 0 &&
    Number.isFinite(asset.height) &&
    asset.height > 0
  );
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  }

  const body = (await request.json()) as { projects?: ProjectUpdate[] };
  if (!Array.isArray(body.projects) || body.projects.length === 0) {
    return Response.json({ error: "No project updates provided" }, { status: 400 });
  }

  const contentDirectory = path.join(process.cwd(), "content");

  for (const update of body.projects) {
    const name = update.name?.trim() ?? "";
    const description = update.description?.trim() ?? "";

    if (
      !/^[a-z0-9-]+$/.test(update.slug) ||
      name.length === 0 ||
      name.length > 160 ||
      !isDate(update.date) ||
      description.length > 5000 ||
      !isHexColor(update.color) ||
      !Array.isArray(update.grid)
    ) {
      return Response.json({ error: "Invalid project update" }, { status: 400 });
    }

    if (!update.grid.every((asset) => isValidAsset(update.slug, asset))) {
      return Response.json({ error: "Invalid grid asset" }, { status: 400 });
    }

    const filePath = path.join(contentDirectory, `${update.slug}.json`);
    const project = JSON.parse(await readFile(filePath, "utf8")) as ProjectFile;
    if (project.slug !== update.slug) {
      return Response.json({ error: "Project slug mismatch" }, { status: 400 });
    }

    const nextProject: ProjectFile = {
      name,
      slug: project.slug,
      date: update.date,
      description,
      color: update.color.toUpperCase(),
      grid: update.grid,
    };
    const temporaryPath = `${filePath}.tmp`;

    await writeFile(
      temporaryPath,
      `${JSON.stringify(nextProject, null, 2)}\n`,
      "utf8",
    );
    await rename(temporaryPath, filePath);
  }

  return Response.json({ saved: body.projects.map((project) => project.slug) });
}
