import { KeyRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Field, Notice } from "../../app/components/ui";
import { authClient } from "../lib/auth-client";
import { requestJson } from "../../app/lib/api";
import { useDialogMotion } from "../../app/components/use-dialog-motion";
import { PasswordSettings } from "./PasswordSettings";

export function LoginPasswordDialog({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const { enter: enterDialog, exit: exitDialog, stop: stopDialog } = useDialogMotion(dialog);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [qqLinked, setQqLinked] = useState<boolean | null>(null);
  const [qqEnabled, setQqEnabled] = useState(false);
  const [binding, setBinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([authClient.listAccounts(), requestJson<{qq:{enabled:boolean}}>("/api/auth/providers")]).then(([accounts,providers]) => {
      if (cancelled) return;
      if (accounts.error) { setError("无法读取登录方式，请稍后重试。"); return; }
      setQqLinked(accounts.data.some(account => account.providerId === "qq")); setQqEnabled(providers.qq.enabled);
    }).catch(() => { if (!cancelled) setError("无法读取登录方式，请稍后重试。"); });
    return () => { cancelled = true; };
  }, [open]);
  async function bindQq() {
    setBinding(true); setError(null);
    try {
      const response = await authClient.oauth2.link({providerId:"qq",callbackURL:"/portal"});
      if (response.error) setError(response.error.message || "QQ 绑定未完成，请重试。");
    } catch { setError("QQ 绑定暂时不可用，请稍后重试。"); }
    finally { setBinding(false); }
  }

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
      <KeyRound size={14} aria-hidden="true" />登录与密码
    </button>
    {open ? createPortal(<dialog ref={dialog} id={id} className="login-password-dialog" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}>
      <header className="login-password-dialog-header">
        <h2 id={`${id}-title`}>登录与密码</h2>
        <button className="icon-button" type="button" aria-label="关闭登录与密码设置" onClick={close}><X size={18} /></button>
      </header>
      <div className="login-password-dialog-body">
        <section className="space-y-3"><h3>QQ 登录</h3>
          {qqLinked === true ? <p>已绑定 QQ，可以使用 QQ 登录此账号。</p> : <>
            <p>绑定后可用 QQ 登录，报名、作品和排期继续保留。</p>
            <Button disabled={!qqEnabled || qqLinked === null || binding} aria-busy={binding} onClick={() => void bindQq()}>{binding ? "正在前往 QQ…" : "绑定 QQ"}</Button>
            {!qqEnabled ? <p className="field-hint">QQ 登录尚未启用。</p> : null}
          </>}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </section>
        {email ? <><Field label="登录邮箱"><input className="field-input" type="email" value={email} readOnly /></Field><PasswordSettings /></> : <p>此账号使用 QQ 登录，无需设置邮箱密码。</p>}
      </div>
    </dialog>, document.body) : null}
  </>;
}
