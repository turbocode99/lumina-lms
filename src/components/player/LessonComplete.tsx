"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, CheckCircle2 } from "lucide-react";

import { toggleLessonCompleteAction } from "@/app/actions/learning";
import { Button } from "@/components/ui/Button";

/**
 * Manual complete/incomplete toggle. Video lessons also auto-complete once the
 * watch threshold is passed, but article and resource lessons need this.
 */
export function LessonCompleteToggle({
  lessonId,
  completed,
}: {
  lessonId: string;
  completed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const formData = new FormData();
    formData.set("lessonId", lessonId);
    formData.set("completed", completed ? "false" : "true");
    startTransition(async () => {
      await toggleLessonCompleteAction(formData);
      router.refresh();
    });
  };

  return (
    <Button
      onClick={submit}
      loading={pending}
      variant={completed ? "success" : "primary"}
    >
      {completed ? (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Completed
        </>
      ) : (
        <>
          <Check className="h-4 w-4" />
          Mark as complete
        </>
      )}
    </Button>
  );
}

export default LessonCompleteToggle;
