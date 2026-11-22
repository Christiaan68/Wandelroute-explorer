"use client";

import { useEffect, useId, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" kleurt de bevestigknop rood/oranje, voor acties die iets verwijderen of beëindigen. */
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Eigen bevestigingsvenster in de stijl van de app, ter vervanging van de
 * standaard pop-up van de browser (window.confirm), die er per browser anders
 * uitziet en op een beginscherm-app soms vreemd oogt.
 *
 * Gebouwd op het HTML <dialog>-element met showModal(): de browser regelt dan
 * zelf dat de rest van de pagina niet bedienbaar is, dat de toetsenbordfocus
 * in het venster blijft en dat Escape het venster sluit (dat telt als
 * "Annuleren"). De focus start op de annuleerknop, zodat per ongeluk op Enter
 * drukken nooit de onomkeerbare actie uitvoert.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Annuleren",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(e) => {
        // Escape-toets: zelf afhandelen, zodat de status in React gelijk blijft.
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        // Tik naast het venster (op de grijze achtergrond) = annuleren.
        if (e.target === dialogRef.current) onCancel();
      }}
      className="w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 id={titleId} className="text-lg font-bold text-moss-800">
            {title}
          </h2>
          <p id={messageId} className="mt-1 text-sm text-bark-700">
            {message}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="tap-target rounded-lg border border-moss-300 px-4 py-2 font-semibold text-moss-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`tap-target rounded-lg px-4 py-2 font-semibold text-white ${
              tone === "danger" ? "bg-alert" : "bg-moss-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
