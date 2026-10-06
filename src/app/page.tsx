import { Header } from "@/components/header";

export default function Home() {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-[1200px] px-4 py-16 sm:px-8">
        <h1 className="font-display text-4xl">Meridian</h1>
      </main>
    </>
  );
}
