import cocaCola from "@/content/coca-cola.json";
import couturelab from "@/content/couturelab.json";
import daisie from "@/content/daisie.json";
import deliverooBusiness from "@/content/deliveroo-business.json";
import docent from "@/content/docent.json";
import field from "@/content/field.json";
import floom from "@/content/floom.json";
import institutDesMutations from "@/content/institut-des-mutations.json";
import juun from "@/content/juun.json";
import kapture from "@/content/kapture.json";
import louboutinLeatherGoods from "@/content/louboutin-leather-goods.json";
import louboutinSelection from "@/content/louboutin-selection.json";
import metaInsights from "@/content/meta-insights.json";
import sportyHenri from "@/content/sporty-henri.json";
import spotifyTechnology from "@/content/spotify-technology.json";
import workplaceMarketingSite from "@/content/workplace-marketing-site.json";

type GridAsset = {
  src: string;
  width: number;
  height: number;
};

type Project = {
  name: string;
  slug: string;
  date: string;
  description: string;
  color: string;
  grid: GridAsset[];
};

export type GridTile = GridAsset & {
  id: string;
  projectName: string;
  projectSlug: string;
  projectColor: string;
};

const projects: Project[] = [
  spotifyTechnology,
  docent,
  metaInsights,
  workplaceMarketingSite,
  daisie,
  deliverooBusiness,
  louboutinSelection,
  kapture,
  floom,
  juun,
  cocaCola,
  louboutinLeatherGoods,
  institutDesMutations,
  sportyHenri,
  couturelab,
  field,
];

export function isVideo(src: string) {
  return src.endsWith(".mp4");
}

function isLogo(src: string) {
  return src.split("/").pop()?.split("?")[0]?.startsWith("logo.") ?? false;
}

export function getGridTiles(): GridTile[] {
  return projects.flatMap((project) =>
    project.grid
      .filter((asset) => !isLogo(asset.src))
      .map((asset) => ({
        ...asset,
        id: `${project.slug}:${asset.src}`,
        projectName: project.name,
        projectSlug: project.slug,
        projectColor: project.color,
      })),
  );
}
