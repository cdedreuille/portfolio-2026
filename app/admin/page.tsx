import { notFound } from "next/navigation";
import { getAdminProjects } from "@/lib/admin-projects";
import { AdminPanel } from "./admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const projects = await getAdminProjects();

  return <AdminPanel initialProjects={projects} />;
}
