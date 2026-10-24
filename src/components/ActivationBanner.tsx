import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const ActivationBanner: React.FC = () => {
  const {
    isAppActivated,
    isTrialActive,
    licenseReadOnly,
    licenseStatus,
    licenseExpiryDate,
    licenseDaysRemaining,
    currentView,
    settingsTab,
    navigateToActivation,
    installationId,
    showToast,
  } = useApp();
  const [copied, setCopied] = useState<'phone' | 'id' | null>(null);

  if (licenseReadOnly) {
    return (
      <div className="w-full mb-6 p-4 rounded-2xl bg-amber-500/10 border-l-4 border-amber-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-700">lock</span>
          <div>
            <h3 className="text-sm font-bold text-on-surface">
              {licenseStatus === 'clock_rollback' ? 'Corrija la hora del sistema' : 'Licencia vencida · Modo de solo lectura'}
            </h3>
            <p className="text-xs text-on-surface-variant mt-1">
              {licenseStatus === 'clock_rollback'
                ? 'La fecha actual es anterior a la última fecha registrada. Corrija la fecha y hora para continuar.'
                : `Puede consultar y exportar sus datos. Venció el ${licenseExpiryDate || '—'}; días restantes: ${licenseDaysRemaining}.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={navigateToActivation}
          className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-colors"
        >
          Renovar licencia
        </button>
      </div>
    );
  }

  // Si la aplicación ya está activada, no se muestra el banner
  if (isAppActivated || isTrialActive) return null;

  // Si ya se encuentra en la sección de activación dentro de configuración, no duplicar el aviso
  const isAlreadyOnActivationSection =
    (currentView === 'configuracion' || currentView === 'respaldo-y-exportacion') &&
    settingsTab === 'licencia';

  if (isAlreadyOnActivationSection) return null;

  const phoneNumber = '+53 63242069';
  const rawPhone = '5363242069';
  const predeterminedMessage = `Hola, solicito el código de activación para FerreStock. Mi ID de instalación es: ${installationId}`;
  const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(predeterminedMessage)}`;

  const handleCopy = async (text: string, type: 'phone' | 'id', label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(type);
      showToast('Copiado', `${label} copiado al portapapeles.`, 'success');
      setTimeout(() => setCopied(null), 2500);
    } catch {
      showToast('Copia manual', `${label}: ${text}`, 'info');
    }
  };

  return (
    <div className="w-full mb-6 p-4 md:p-5 rounded-2xl bg-surface neo-raised border-l-4 border-amber-500 flex flex-col gap-4 animate-in fade-in duration-300 select-none">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Info */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 neo-inset flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[26px]">key</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-bold text-on-surface">
                Aplicación Pendiente de Activación
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 text-[10px] font-bold font-mono uppercase tracking-wide border border-amber-500/30">
                Licencia Requerida
              </span>
            </div>
            <p className="text-sm text-on-surface-variant mt-1 leading-relaxed max-w-3xl">
              Todas las funciones operativas (ventas, cierre, productos e informes) se encuentran deshabilitadas hasta validar su código de activación único.
            </p>
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">

          {/* Go to Config / Activation */}
          <button
            type="button"
            onClick={navigateToActivation}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary-container active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">lock_open</span>
            <span>Activar Aplicación</span>
          </button>
        </div>
      </div>

      {/* Separate phone contact info strip (in case user does not have WhatsApp on PC) */}
      <div className="pt-3 border-t border-outline-variant/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-sm text-on-surface-variant bg-surface-container-low/40 p-2.5 rounded-xl">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-on-surface">Tu prueba gratuita de 7 días ha culminado.</span>
          <span>Presione el botón de Activar Aplicación y luego continúe los pasos en la sección de activación dentro de la configuración del sistema</span>
          
        </div>
      </div>
    </div>
  );
};
