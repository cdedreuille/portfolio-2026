import type { Metadata } from "next";
import { LemmingsGame } from "./game";

export const metadata: Metadata = {
  title: "Walkers — Charlie",
  description: "A tiny walker experiment",
};

export default function LemmingsPage() {
  return <LemmingsGame />;
}
