import React, { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import Button from "./Button";

/**
 * A component that prevents accidental navigation when a form has unsaved changes.
 * It handles both in-app React Router navigation (via useBlocker) and full page
 * reloads or tab closures (via window beforeunload event).
 *
 * @param {boolean} isDirty - True if the form has unsaved changes.
 */
export default function UnsavedChangesGuard({ isDirty }) {
  // Block in-app navigation if form is dirty and we are navigating to a different path
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Block native browser navigation (refresh, closing tab, typing new URL)
  // Disabled as per user request to only show the custom React modal
  // useEffect(() => {
  //   if (!isDirty) return;
  //   const handleBeforeUnload = (event) => {
  //     event.preventDefault();
  //     event.returnValue = "You have unsaved changes. Are you sure you want to leave?";
  //     return "You have unsaved changes. Are you sure you want to leave?";
  //   };
  //   window.addEventListener("beforeunload", handleBeforeUnload);
  //   return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  // }, [isDirty]);

  if (blocker.state !== "blocked") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={() => blocker.reset()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all">
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle size={24} strokeWidth={2.5} />
          </div>
          <div className="pt-1">
            <h3 className="text-lg font-black text-slate-900">Unsaved Changes</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              You have unsaved changes. Are you sure you want to discard them and leave this page?
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => blocker.reset()}>
            Keep Editing
          </Button>
          <Button variant="danger" onClick={() => blocker.proceed()}>
            Discard Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
