"use client";

import { createContext, useActionState, useContext, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { initialFormState, type FormState } from "@/lib/form-state";

export const FormStateContext = createContext<FormState | undefined>(undefined);
export const useFormState = () => useContext(FormStateContext);

type Confirm = { title: string; body: string; action: string };

// A form that stays on the page: the server action returns a result, the page data refreshes in
// place (no scroll jump), and the outcome appears as a toast. Submit buttons with a `confirm`
// prop ask first in a modal dialog.
export function ActionForm({ action, children, className, resetOnSuccess = true }: { action: (state: FormState, form: FormData) => Promise<FormState>; children: React.ReactNode; className?: string; resetOnSuccess?: boolean }) {
  // Toast as soon as the result arrives: a decided item may leave the page in the same render.
  const [state, formAction] = useActionState(async (previous: FormState, data: FormData) => {
    const result = await action(previous, data);
    if (result.success) toast.success(result.success);
    else if (result.error) toast.error(result.error);
    return result;
  }, initialFormState);
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<HTMLButtonElement | null>(null);
  const confirmed = useRef(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (state.at && state.success && resetOnSuccess) form.current?.reset();
  }, [state.at, state.success, resetOnSuccess]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const title = submitter?.dataset.confirmTitle;
    if (!title || confirmed.current) {
      confirmed.current = false;
      return;
    }
    event.preventDefault();
    pending.current = submitter;
    setConfirm({ title, body: submitter.dataset.confirmBody ?? "", action: submitter.dataset.confirmAction ?? "Confirm" });
    dialog.current?.showModal();
  }

  function proceed() {
    dialog.current?.close();
    confirmed.current = true;
    form.current?.requestSubmit(pending.current ?? undefined);
  }

  return (
    <FormStateContext.Provider value={state}>
      <form ref={form} action={formAction} onSubmit={onSubmit} className={className} noValidate>
        {children}
      </form>
      <dialog ref={dialog} className="confirm-dialog" aria-labelledby={titleId} onClose={() => setConfirm(null)}>
        {confirm && (
          <div className="confirm-body">
            <span className="confirm-icon" aria-hidden="true"><AlertTriangle size={22} /></span>
            <h2 id={titleId}>{confirm.title}</h2>
            <p className="muted">{confirm.body}</p>
            <div className="actions">
              <button type="button" className="button button-secondary" onClick={() => dialog.current?.close()} autoFocus>Cancel</button>
              <button type="button" className="button button-danger" onClick={proceed}>{confirm.action}</button>
            </div>
          </div>
        )}
      </dialog>
    </FormStateContext.Provider>
  );
}
