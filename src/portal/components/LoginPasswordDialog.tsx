import { useSiteTranslation } from "../../i18n/use-site-translation";
import { KeyRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Field } from "../../app/components/ui";
import { useDialogMotion } from "../../app/components/use-dialog-motion";
import { PasswordSettings } from "./PasswordSettings";

export function LoginPasswordDialog({ email }: { email: string | null }) {
  const { t } = useSiteTranslation();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const { enter: enterDialog, exit: exitDialog, stop: stopDialog } = useDialogMotion(dialog);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    enterDialog();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      stopDialog();
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open, enterDialog, stopDialog]);

  function close() {
    exitDialog(() => {
      dialog.current?.close();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    });
  }

  return <>
    <button ref={trigger} type="button" className="login-password-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(true)}>
      <KeyRound size={14} aria-hidden="true" />{t("auth.dialog.title")}
    </button>
    {open ? createPortal(<dialog ref={dialog} id={id} className="login-password-dialog" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}>
      <header className="login-password-dialog-header">
        <h2 id={`${id}-title`}>{t("auth.dialog.title")}</h2>
        <button className="icon-button" type="button" aria-label={t("auth.dialog.close")} onClick={close}><X size={18} /></button>
      </header>
      <div className="login-password-dialog-body">
        {email ? <><Field label={t("auth.field.email")}><input className="field-input" type="email" value={email} readOnly /></Field><PasswordSettings /></> : <p>{t("auth.dialog.noEmail")}</p>}
      </div>
    </dialog>, document.body) : null}
  </>;
}
