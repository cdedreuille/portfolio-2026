import { ProjectMasonry } from "@/components/project-masonry";
import { getGridTiles } from "@/lib/projects";

export default function Home() {
  return (
    <main>
      <ProjectMasonry tiles={getGridTiles()} />
    </main>
  );
}
