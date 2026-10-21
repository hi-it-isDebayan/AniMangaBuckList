"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RegisterSourceForm } from "@/components/sources/register-source-form";

/**
 * Collapsible "Add source" panel.
 *
 * Closed: only a single **Add** button is shown, so the directory stays clean.
 * Open: the registration form is revealed. Submitting it (or pressing Done)
 * hides the form again and leaves the list to speak for itself.
 */
export function AddSourcePanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Add source
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Add a source</h2>
            <p className="text-sm text-muted-foreground">
              Register the site once — everyone links to the same entry.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close add source"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <RegisterSourceForm onDone={() => setOpen(false)} />
      </CardContent>
    </Card>
  );
}
