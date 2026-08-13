"use client";

import { useFormStatus } from "react-dom";
import { ImageIcon } from "lucide-react";

import { setCourseThumbnailAction } from "@/app/actions/authoring";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";

import { UploadField } from "./UploadField";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending}>
      Save thumbnail
    </Button>
  );
}

export function CourseMediaPanel({
  courseId,
  thumbnailUrl,
}: {
  courseId: string;
  thumbnailUrl: string | null;
}) {
  return (
    <Card>
      <CardTitle className="mb-2 flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-[var(--accent)]" />
        Course thumbnail
      </CardTitle>
      <p className="mb-5 text-sm text-[var(--text-muted)]">
        Shown on catalog cards and the course page. A 16:9 image around
        1280×720 looks best.
      </p>

      <form action={setCourseThumbnailAction} className="space-y-5">
        <input type="hidden" name="courseId" value={courseId} />
        <UploadField
          name="thumbnailUrl"
          label="Image"
          kind="image"
          defaultValue={thumbnailUrl ?? ""}
          hint="JPG, PNG, or WebP."
        />
        <SaveButton />
      </form>
    </Card>
  );
}

export default CourseMediaPanel;
