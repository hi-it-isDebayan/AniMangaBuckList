"use client";

import { useRouter } from "next/navigation";
import type { LibraryStatus } from "@ambl/types";
import { updateStatusAction } from "@/actions/library";
import { Select } from "@/components/ui/select";
import { LIBRARY_STATUSES, libraryStatusLabel } from "@/lib/format";

export function StatusSelect({
  titleId,
  status,
}: {
  titleId: string;
  status: LibraryStatus;
}) {
  const router = useRouter();

  return (
    <Select
      value={status}
      onChange={async (e) => {
        await updateStatusAction({
          titleId,
          status: e.target.value as LibraryStatus,
        });
        router.refresh();
      }}
      className="h-8 w-auto"
      aria-label="Library status"
    >
      {LIBRARY_STATUSES.map((s) => (
        <option key={s} value={s}>
          {libraryStatusLabel(s)}
        </option>
      ))}
    </Select>
  );
}