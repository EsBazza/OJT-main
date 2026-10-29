"use client";

import { Undo2 } from "lucide-react";
import { withdrawReport } from "@/app/actions/student";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";

export function WithdrawForm({ versionId, day }: { versionId: string; day: number }) {
  return (
    <ActionForm action={withdrawReport}>
      <input type="hidden" name="versionId" value={versionId} />
      <SubmitButton variant="ghost" className="button-small" pendingText="Withdrawing…" confirm={{ title: `Withdraw your Day ${day} report?`, body: "It leaves your supervisor's queue so you can edit it. Remember to resubmit it.", action: "Withdraw" }}><Undo2 aria-hidden="true" size={16} />Withdraw to edit</SubmitButton>
    </ActionForm>
  );
}
