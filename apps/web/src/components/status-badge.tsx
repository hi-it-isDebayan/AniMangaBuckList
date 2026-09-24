import type { LibraryStatus, MediaType } from "@ambl/types";
import { Badge } from "@/components/ui/badge";
import {
  libraryStatusBadge,
  libraryStatusLabel,
  mediaTypeBadgeClass,
  mediaTypeLabel,
} from "@/lib/format";

export function StatusBadge({ status }: { status: LibraryStatus }) {
  return (
    <Badge variant={libraryStatusBadge(status)} className="capitalize">
      {libraryStatusLabel(status)}
    </Badge>
  );
}

export function MediaTypeBadge({ type }: { type: MediaType }) {
  return <Badge className={mediaTypeBadgeClass(type)}>{mediaTypeLabel(type)}</Badge>;
}