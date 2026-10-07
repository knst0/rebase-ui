import { Title } from "@solidjs/meta";

export default function NotFound() {
  return (
    <main class="mx-auto mt-12 flex h-screen w-full max-w-[680px] items-center justify-center py-20 sm:py-28 lg:mt-0">
      <Title>Not found</Title>
      <h1 class="text-center text-2xl">Page not found</h1>
    </main>
  );
}
