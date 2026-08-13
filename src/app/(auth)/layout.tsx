import Link from "next/link";
import { GraduationCap, ShieldCheck, Route, Award } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { luminaConfig } from "~/lumina.config";

const HIGHLIGHTS = [
  {
    icon: <Route className="h-5 w-5" />,
    title: "Guided learning paths",
    body: "Sequence courses into onboarding tracks and role-based curricula.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Compliance built in",
    body: "Assign required training with due dates and track completion org-wide.",
  },
  {
    icon: <Award className="h-5 w-5" />,
    title: "Certificates on completion",
    body: "Verifiable, printable proof the moment a learner finishes.",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Marketing rail — hidden below lg so the form owns small screens. */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex xl:w-[55%]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            background:
              "radial-gradient(circle at 25% 20%, var(--accent) 0%, transparent 45%), radial-gradient(circle at 80% 75%, var(--secondary) 0%, transparent 42%)",
          }}
          aria-hidden
        />

        <Link href="/" className="relative flex items-center gap-3">
          <span className="neu flex h-12 w-12 items-center justify-center rounded-2xl text-[var(--accent)]">
            <GraduationCap className="h-6 w-6" />
          </span>
          <span className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {luminaConfig.brand.name}
          </span>
        </Link>

        <div className="relative max-w-lg">
          <h1 className="text-5xl font-extrabold leading-[1.08] tracking-tight text-[var(--text-primary)]">
            Everyone learns.
            <br />
            <span className="text-gradient">Nobody gets left behind.</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[var(--text-secondary)]">
            {luminaConfig.brand.organization}&apos;s internal learning platform —
            course catalog, required training, and progress tracking in one place.
          </p>

          <div className="mt-10 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <div key={item.title} className="flex items-start gap-4">
                <span className="neu-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[var(--accent)]">
                  {item.icon}
                </span>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-[var(--text-muted)]">
          © {new Date().getFullYear()} {luminaConfig.brand.organization}
        </p>
      </aside>

      {/* Form column */}
      <main
        id="main"
        className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2 xl:w-[45%]"
      >
        <div className="absolute right-6 top-6">
          <ThemeToggle compact />
        </div>

        <div className="w-full max-w-md animate-fade-up">
          <Link
            href="/"
            className="mb-8 flex items-center gap-3 lg:hidden"
            aria-label={luminaConfig.brand.name}
          >
            <span className="neu flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--accent)]">
              <GraduationCap className="h-6 w-6" />
            </span>
            <span className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              {luminaConfig.brand.name}
            </span>
          </Link>

          {children}
        </div>
      </main>
    </div>
  );
}
