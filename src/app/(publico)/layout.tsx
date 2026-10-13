import { Logo } from "@/components/Logo";

export default function LayoutPublico({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo className="h-12" />
        <p className="mt-3 text-xs text-tenue">Observa. Mide. Haz crecer.</p>
      </div>
      {children}
    </main>
  );
}
