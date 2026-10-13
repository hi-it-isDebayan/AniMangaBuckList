"use client";

import { useActionState, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Send, Trash2 } from "lucide-react";
import {
  addCommentAction,
  deleteCommentAction,
  type CommentActionState,
} from "@/actions/comments";
import { relativeTime } from "@/lib/format";

export interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
}

export function CommentSection({
  seriesId,
  comments,
  currentUserId,
}: {
  seriesId: number;
  comments: CommentItem[];
  currentUserId: string;
}) {
  const [state, formAction, pending] = useActionState<CommentActionState, FormData>(
    addCommentAction,
    {},
  );

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="seriesId" value={seriesId} />
        <textarea
          name="body"
          required
          maxLength={2000}
          rows={3}
          placeholder="Share your thoughts..."
          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
        />
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {pending ? "Posting..." : "Comment"}
          </button>
        </div>
      </form>

      {comments.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          No comments yet. Be the first to start the discussion.
        </p>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <CommentRow key={c.id} comment={c} isOwn={c.authorId === currentUserId} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function CommentRow({ comment, isOwn }: { comment: CommentItem; isOwn: boolean }) {
  const [pending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: removed ? 0 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="flex gap-3 rounded-lg border bg-card p-3"
    >
      {comment.authorAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={comment.authorAvatar}
          alt=""
          referrerPolicy="no-referrer"
          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border"
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-border">
          {comment.authorName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{comment.authorName}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {relativeTime(comment.createdAt)}
          </span>
          {isOwn && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteCommentAction({ commentId: comment.id });
                })
              }
              className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
              aria-label="Delete comment"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/90">
          {comment.body}
        </p>
      </div>
    </motion.li>
  );
}
