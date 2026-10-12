"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { titleComments } from "@ambl/database";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export interface CommentActionState {
  error?: string;
  success?: boolean;
}

const commentSchema = z.object({
  seriesId: z.coerce.number().int().positive(),
  body: z.string().trim().min(1, "Write something first.").max(2000, "Comment is too long."),
});

export async function addCommentAction(
  _prev: CommentActionState,
  formData: FormData,
): Promise<CommentActionState> {
  const user = await requireUser();
  const parsed = commentSchema.safeParse({
    seriesId: formData.get("seriesId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid comment." };
  }

  await getDb().insert(titleComments).values({
    userId: user.id,
    seriesId: parsed.data.seriesId,
    body: parsed.data.body,
  });

  revalidatePath(`/series/${parsed.data.seriesId}`);
  return { success: true };
}

export async function deleteCommentAction(input: { commentId: string }): Promise<CommentActionState> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(input.commentId);
  if (!id.success) return { error: "Invalid comment." };

  await getDb()
    .delete(titleComments)
    .where(and(eq(titleComments.id, id.data), eq(titleComments.userId, user.id)));

  revalidatePath("/series");
  return { success: true };
}
