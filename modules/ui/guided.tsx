"use client";
import { useId, useState, cloneElement, isValidElement } from "react";
import { useLocale } from "@/modules/localization/ui/provider";
export function Help({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { t } = useLocale();
  return (
    <span className="inline-help">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t("help")}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        ?
      </button>
      {open && (
        <span id={id} role="note">
          {text}
        </span>
      )}
    </span>
  );
}
export function GuidedField({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="guided-field">
      <div className="guided-label">
        <label htmlFor={id}>{label}</label>
        {help && <Help text={help} />}
      </div>
      {isValidElement(children)
        ? cloneElement(children as React.ReactElement<{ id: string }>, { id })
        : children}
    </div>
  );
}
export function ModuleHeading({
  title,
  help,
}: {
  title: string;
  help: string;
}) {
  return (
    <header className="module-heading">
      <p className="eyebrow">CUELANCE</p>
      <h1>{title}</h1>
      <p>{help}</p>
    </header>
  );
}
export function Status({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return text ? (
    <p
      className={`notice ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {text}
    </p>
  ) : null;
}
