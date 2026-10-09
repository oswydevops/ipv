import React from 'react';
import { useApp } from '../context/AppContext';

export const Toast: React.FC = () => {
  const { toast, hideToast } = useApp();

  if (!toast) return null;

  const isSuccess = toast.type === 'success' || !toast.type;
  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-6 right-8 z-50 rounded-2xl bg-surface neo-raised p-4 flex items-center gap-3.5 border-l-4 border-emerald-500 shadow-2xl transition-all duration-300">
      <div
        className={`w-9 h-9 rounded-xl ${
          isError
            ? 'bg-error-container text-error'
            : isSuccess
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-primary-fixed text-primary'
        } flex items-center justify-center shrink-0`}
      >
        <span className="material-symbols-outlined text-[20px]">
          {isError ? 'warning' : isSuccess ? 'check_circle' : 'info'}
        </span>
      </div>
      <div className="flex flex-col pr-2">
        <span className="text-xs font-bold text-on-surface">{toast.title}</span>
        <span className="text-[11px] text-on-surface-variant font-medium mt-0.5">{toast.desc}</span>
      </div>
      <button
        onClick={hideToast}
        className="w-6 h-6 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
        type="button"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
};
