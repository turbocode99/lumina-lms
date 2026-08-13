import type { Metadata } from "next";
import { BookOpen, GraduationCap, Library, PlayCircle } from "lucide-react";

import { CourseCard, type CourseCardData } from "@/components/CourseCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";

export const metadata: Metadata = { title: "My learning" };
export const dynamic = "force-dynamic";

const COURSE_SELECT = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  thumbnailUrl: true,
  level: true,
  durationMinutes: true,
  lessonCount: true,
  ratingAvg: true,
  ratingCount: true,
  enrollmentCount: true,
  isMandatory: true,
  instructor: { select: { name: true } },
  category: { select: { name: true, color: true } },
} as const;

export default async function MyLearningPage() {
  const user = await requireUser("/my-learning");

  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id },
    orderBy: [{ startedAt: "desc" }, { enrolledAt: "desc" }],
    include: { course: { select: COURSE_SELECT } },
  });

  const inProgress = enrollments.filter(
    (e) => e.progressPercent > 0 && e.progressPercent < 100
  );
  const notStarted = enrollments.filter((e) => e.progressPercent === 0);
  const completed = enrollments.filter((e) => e.progressPercent >= 100);

  const grid = (
    list: typeof enrollments,
    empty: { title: string; description: string }
  ) =>
    list.length === 0 ? (
      <Card>
        <EmptyState
          icon={<Library className="h-9 w-9" />}
          title={empty.title}
          description={empty.description}
          action={{ label: "Browse catalog", href: "/catalog" }}
        />
      </Card>
    ) : (
      <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {list.map((enrollment) => (
          <CourseCard
            key={enrollment.id}
            course={enrollment.course as CourseCardData}
            progress={enrollment.progressPercent}
          />
        ))}
      </div>
    );

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          My learning
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Every course you&apos;re enrolled in, grouped by where you are with it.
        </p>
      </header>

      <Tabs
        items={[
          {
            id: "all",
            label: "All",
            icon: <Library className="h-4 w-4" />,
            count: enrollments.length,
            content: grid(enrollments, {
              title: "You're not enrolled in anything yet",
              description:
                "Find something relevant to your role in the catalog and enroll.",
            }),
          },
          {
            id: "in-progress",
            label: "In progress",
            icon: <PlayCircle className="h-4 w-4" />,
            count: inProgress.length,
            content: grid(inProgress, {
              title: "Nothing in progress",
              description:
                "Start one of your enrolled courses, or find a new one in the catalog.",
            }),
          },
          {
            id: "not-started",
            label: "Not started",
            icon: <BookOpen className="h-4 w-4" />,
            count: notStarted.length,
            content: grid(notStarted, {
              title: "Nothing waiting",
              description: "You've made a start on everything you're enrolled in.",
            }),
          },
          {
            id: "completed",
            label: "Completed",
            icon: <GraduationCap className="h-4 w-4" />,
            count: completed.length,
            content: grid(completed, {
              title: "No completions yet",
              description:
                "Finish a course and it'll show up here along with your certificate.",
            }),
          },
        ]}
      />
    </div>
  );
}
