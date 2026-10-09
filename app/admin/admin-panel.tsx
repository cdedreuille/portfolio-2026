"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminAsset, AdminProject } from "@/lib/admin-projects";
import styles from "./admin.module.css";

type SaveState = "idle" | "saving" | "saved" | "error";

function getImageDimensions(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = src;
  });
}

function AssetPreview({ asset }: { asset: AdminAsset }) {
  if (asset.type === "video") {
    return (
      <video
        className={styles.preview}
        src={asset.src}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <span
      className={styles.preview}
      style={{ backgroundImage: `url("${asset.src}")` }}
    />
  );
}

export function AdminPanel({
  initialProjects,
}: {
  initialProjects: AdminProject[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [activeSlug, setActiveSlug] = useState("all");
  const [dirtySlugs, setDirtySlugs] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const projectsRef = useRef(projects);
  const dirtyRef = useRef(dirtySlugs);
  const revisionRef = useRef(0);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const saveRef = useRef<() => Promise<void>>(async () => {});

  const orderedProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name),
      ),
    [projects],
  );
  const visibleProjects = useMemo(
    () =>
      activeSlug === "all"
        ? orderedProjects
        : orderedProjects.filter((project) => project.slug === activeSlug),
    [activeSlug, orderedProjects],
  );
  const selectedCount = projects.reduce(
    (total, project) =>
      total + project.assets.filter((asset) => asset.selected).length,
    0,
  );

  async function toggleAsset(projectSlug: string, assetSrc: string) {
    const project = projects.find(({ slug }) => slug === projectSlug);
    const asset = project?.assets.find(({ src }) => src === assetSrc);
    if (!asset) return;

    let dimensions = { width: asset.width, height: asset.height };
    if (!asset.selected && (!asset.width || !asset.height)) {
      try {
        dimensions = await getImageDimensions(asset.src);
      } catch {
        setSaveState("error");
        return;
      }
    }

    setProjects((current) =>
      current.map((item) =>
        item.slug === projectSlug
          ? {
              ...item,
              assets: item.assets.map((itemAsset) =>
                itemAsset.src === assetSrc
                  ? {
                      ...itemAsset,
                      ...dimensions,
                      selected: !itemAsset.selected,
                    }
                  : itemAsset,
              ),
            }
          : item,
      ),
    );
    markDirty(projectSlug);
  }

  function updateProject(
    projectSlug: string,
    patch: Partial<Pick<AdminProject, "name" | "date" | "description" | "color">>,
  ) {
    setProjects((current) =>
      current.map((project) =>
        project.slug === projectSlug ? { ...project, ...patch } : project,
      ),
    );
    markDirty(projectSlug);
  }

  function markDirty(projectSlug: string) {
    revisionRef.current += 1;
    setDirtySlugs((current) => new Set(current).add(projectSlug));
    setSaveState("idle");
  }

  async function save() {
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }

    const slugs = dirtyRef.current;
    if (slugs.size === 0) return;

    const revision = revisionRef.current;
    const updates = projectsRef.current
      .filter((project) => slugs.has(project.slug))
      .map((project) => ({
        slug: project.slug,
        name: project.name,
        date: project.date,
        description: project.description,
        color: project.color,
        grid: project.assets
          .filter((asset) => asset.selected)
          .map(({ src, width, height }) => ({ src, width, height })),
      }));

    savingRef.current = true;
    pendingRef.current = false;
    setSaveState("saving");

    try {
      const response = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projects: updates }),
      });

      if (!response.ok) throw new Error("Could not save projects");
      if (revisionRef.current === revision) {
        setDirtySlugs(new Set());
        setSaveState("saved");
      } else {
        pendingRef.current = true;
      }
      router.refresh();
    } catch {
      setSaveState("error");
    } finally {
      savingRef.current = false;
      if (pendingRef.current) void save();
    }
  }

  useEffect(() => {
    projectsRef.current = projects;
    dirtyRef.current = dirtySlugs;
    saveRef.current = save;
  });

  useEffect(() => {
    if (dirtySlugs.size === 0) return;

    const timer = window.setTimeout(() => {
      void saveRef.current();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [dirtySlugs, projects]);

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <header>
          <p className={styles.eyebrow}>Grid editor</p>
          <h1>Projects</h1>
        </header>

        <nav aria-label="Projects">
          <button
            className={activeSlug === "all" ? styles.activeNav : undefined}
            type="button"
            onClick={() => setActiveSlug("all")}
          >
            <span>All projects</span>
            <span>{selectedCount}</span>
          </button>
          <div className={styles.navDivider} />
          {orderedProjects.map((project) => (
            <button
              className={
                activeSlug === project.slug ? styles.activeNav : undefined
              }
              key={project.slug}
              type="button"
              onClick={() => setActiveSlug(project.slug)}
            >
              <span>{project.name.trim() || "Untitled"}</span>
              <span>
                {project.assets.filter((asset) => asset.selected).length}
              </span>
            </button>
          ))}
        </nav>

        <div className={styles.saveArea}>
          <p aria-live="polite">
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Saved"}
            {saveState === "error" && (
              <button type="button" onClick={() => void save()}>
                Couldn’t save. Try again.
              </button>
            )}
          </p>
        </div>
      </aside>

      <section className={styles.content}>
        {visibleProjects.map((project) => (
          <section className={styles.project} key={project.slug}>
            <div className={styles.details}>
              <label>
                Title
                <input
                  className={styles.titleInput}
                  value={project.name}
                  onChange={(event) =>
                    updateProject(project.slug, { name: event.target.value })
                  }
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={project.date}
                  onChange={(event) =>
                    updateProject(project.slug, { date: event.target.value })
                  }
                />
              </label>
              <label className={styles.colorField}>
                Background
                <input
                  type="color"
                  value={project.color.toLowerCase()}
                  onChange={(event) =>
                    updateProject(project.slug, {
                      color: event.target.value.toUpperCase(),
                    })
                  }
                />
                <span>{project.color.toUpperCase()}</span>
              </label>
              <label className={styles.descriptionField}>
                Description
                <textarea
                  rows={3}
                  value={project.description}
                  onChange={(event) =>
                    updateProject(project.slug, {
                      description: event.target.value,
                    })
                  }
                />
              </label>
            </div>

            <div className={styles.assetGrid}>
              {project.assets.map((asset) => (
                <button
                  aria-checked={asset.selected}
                  className={`${styles.asset} ${
                    asset.selected ? styles.selectedAsset : ""
                  }`}
                  key={asset.src}
                  role="checkbox"
                  type="button"
                  onClick={() => toggleAsset(project.slug, asset.src)}
                >
                  <AssetPreview asset={asset} />
                  <span className={styles.checkbox} aria-hidden="true">
                    {asset.selected ? "✓" : ""}
                  </span>
                  <span className={styles.filename}>
                    {asset.src.split("/").pop()}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
