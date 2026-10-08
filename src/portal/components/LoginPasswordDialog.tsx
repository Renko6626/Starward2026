import { KeyRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Field } from "../../app/components/ui";
import { PasswordSettings } from "./PasswordSettings";

export function LoginPasswordDialog({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function close() {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return <>
    <button ref={trigger} type="button" className="login-password-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(true)}>
      <KeyRound size={14} aria-hidden="true" />登录与密码
    </button>
    {open ? createPortal(<dialog ref={dialog} id={id} className="login-password-dialog" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}>
      <header className="login-password-dialog-header">
        <h2 id={`${id}-title`}>登录与密码</h2>
        <button className="icon-button" type="button" aria-label="关闭登录与密码设置" onClick={close}><X size={18} /></button>
      </header>
      <div className="login-password-dialog-body">
        <Field label="注册邮箱"><input className="field-input" type="email" value={email} readOnly /></Field>
        <PasswordSettings />
      </div>
    </dialog>, document.body) : null}
  </>;
}
