import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Charlie</h1>
      <Link href="/lemmings" className="home-play">
        walkers
      </Link>
    </main>
  );
}
