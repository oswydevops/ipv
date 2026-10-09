import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const Header: React.FC = () => {
  const { setIsSearchModalOpen, showToast, currentView } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const isBackupView = currentView === 'respaldo-y-exportacion';

  return (
    <>
      <header className="fixed top-0 left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 flex items-center justify-between px-8 shadow-[0_1px_8px_rgba(0,0,0,0.04)] select-none">
        {/* Search Bar Trigger - Hidden in Respaldo y Exportación view */}
        <div className="flex items-center gap-3">
          {!isBackupView ? (
            <div
              onClick={() => setIsSearchModalOpen(true)}
              className="h-10 px-4 rounded-xl bg-surface neo-inset flex items-center gap-2.5 text-on-surface-variant w-72 cursor-pointer hover:opacity-90 transition-opacity"
              title="Presione F2 para búsqueda global"
            >
              <span className="material-symbols-outlined text-[20px]">search</span>
              <span className="text-xs text-on-surface-variant font-medium select-none">
                Buscar productos, códigos...
              </span>
              <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface neo-raised text-on-surface-variant">
                [F2]
              </span>
            </div>
          ) : (
            <div className="h-10" />
          )}
        </div>

        {/* Status Indicators & Profile */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Date */}
            <div className="h-8 px-3 rounded-full bg-surface neo-raised hidden xl:flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              <span>Lunes, 24 de Octubre de 2024</span>
            </div>
          </div>

          <div className="h-6 w-px bg-outline-variant/50"></div>

          {/* Notifications & Profile Icon */}
          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-9 h-9 rounded-xl bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface active:neo-inset transition-all relative"
              type="button"
              title="Notificaciones del sistema"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 rounded-2xl bg-surface neo-raised p-4 z-50 flex flex-col gap-3 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
                  <span className="text-xs font-bold text-on-surface">Notificaciones de Terminal</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-bold">2 nuevas</span>
                </div>
                <div className="flex flex-col gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-surface neo-inset flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">warning</span>
                    <div>
                      <p className="font-semibold text-on-surface leading-tight">3 artículos con stock en cero</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">Interruptores y uniones PVC requieren pedido urgente.</p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface neo-inset flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">check_circle</span>
                    <div>
                      <p className="font-semibold text-on-surface leading-tight">Respaldo USB verificado</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">Unidad Kingston (D:\) validada con suma SHA-256.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => showToast('Usuario Activo', 'M. Gómez · Encargado Turno A · Terminal T-01')}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white hover:opacity-90 transition-opacity"
              type="button"
            >
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
