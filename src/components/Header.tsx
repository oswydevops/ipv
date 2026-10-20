import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { APP_NAME } from '../config';
import { ViewType } from '../types';

interface SystemNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  view?: ViewType;
  actionLabel?: string;
}

export const Header: React.FC = () => {
  const {
    setIsSearchModalOpen,
    showToast,
    currentView,
    setCurrentView,
    products = [],
    sales = [],
    ipvTotalVendido = 0,
    isCurrentDayClosed,
    backupRecords = [],
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const isBackupView = currentView === 'respaldo-y-exportacion';
  const notifRef = useRef<HTMLDivElement>(null);

  // Lista de IDs de notificaciones descartadas por el usuario
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ferrestock_dismissed_notifs') || '[]');
    } catch {
      return [];
    }
  });

  // Cerrar el popover al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Generación dinámica de eventos y notificaciones basados en el estado real del sistema
  const allNotifications = useMemo(() => {
    const list: SystemNotification[] = [];

    // 1. Stock agotado (Crítico)
    const outProducts = products.filter((p) => p.status === 'out' || p.stock === 0);
    if (outProducts.length > 0) {
      list.push({
        id: `stock-out-${outProducts.length}`,
        title: `${outProducts.length} ${outProducts.length === 1 ? 'artículo sin existencias' : 'artículos sin existencias'}`,
        description:
          outProducts.length === 1
            ? `«${outProducts[0].name}» tiene stock en 0. Requiere pedido urgente.`
            : `«${outProducts[0].name}» y ${outProducts.length - 1} más tienen existencias en cero.`,
        time: 'Alerta crítica',
        type: 'critical',
        view: 'alertas-de-stock',
        actionLabel: 'Ver Alertas',
      });
    }

    // 2. Stock bajo (Alerta de reposición)
    const lowProducts = products.filter((p) => p.status === 'low' && p.stock > 0);
    if (lowProducts.length > 0) {
      list.push({
        id: `stock-low-${lowProducts.length}`,
        title: `${lowProducts.length} ${lowProducts.length === 1 ? 'artículo con stock bajo' : 'artículos con stock bajo'}`,
        description:
          lowProducts.length === 1
            ? `«${lowProducts[0].name}» (${lowProducts[0].stock} ${lowProducts[0].um}) por debajo del mínimo.`
            : `«${lowProducts[0].name}» y ${lowProducts.length - 1} más alcanzaron el nivel de alerta.`,
        time: 'Alerta de stock',
        type: 'warning',
        view: 'alertas-de-stock',
        actionLabel: 'Ver Alertas',
      });
    }

    // 3. Cierre de caja del día pendiente
    if ((sales.length > 0 || ipvTotalVendido > 0) && !isCurrentDayClosed) {
      list.push({
        id: 'cash-close-pending',
        title: 'Cierre de caja del día pendiente',
        description: `Hay operaciones registradas hoy ($${(ipvTotalVendido || 0).toLocaleString('es-CU', {
          minimumFractionDigits: 2,
        })} CUP) pendientes de arqueo.`,
        time: 'Jornada activa',
        type: 'warning',
        view: 'cierre-de-caja',
        actionLabel: 'Ir a Cierre',
      });
    }

    // 4. Ventas anuladas en la jornada
    const voidedSales = sales.filter((s) => (s as any).voided);
    if (voidedSales.length > 0) {
      list.push({
        id: `voided-sales-${voidedSales.length}`,
        title: `${voidedSales.length} ${voidedSales.length === 1 ? 'ticket anulado' : 'tickets anulados'}`,
        description: `Auditoría: Se anuló el ticket ${voidedSales[0].ticketNumber}. Existencias reintegradas al IPV.`,
        time: voidedSales[0].timestamp || 'Hoy',
        type: 'info',
        view: 'historial-ventas',
        actionLabel: 'Ver Historial',
      });
    }

    // 5. Último respaldo registrado
    if (backupRecords.length > 0 && backupRecords[0].status === 'Exitoso') {
      const b = backupRecords[0];
      list.push({
        id: `backup-${b.id}`,
        title: 'Copia de seguridad registrada',
        description: `${b.fileName} · Respaldo local generado con éxito.`,
        time: b.date,
        type: 'success',
        view: 'respaldo-y-exportacion',
        actionLabel: 'Ver Respaldos',
      });
    }

    return list;
  }, [products, sales, ipvTotalVendido, isCurrentDayClosed, backupRecords]);

  // Filtrar las notificaciones que no han sido descartadas por el usuario
  const activeNotifications = useMemo(() => {
    return allNotifications.filter((n) => !dismissedIds.includes(n.id));
  }, [allNotifications, dismissedIds]);

  const handleDismissOne = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDismissedIds((prev) => {
      const next = [...prev, id];
      try {
        localStorage.setItem('ferrestock_dismissed_notifs', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleDismissAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const allIds = allNotifications.map((n) => n.id);
    setDismissedIds((prev) => {
      const next = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem('ferrestock_dismissed_notifs', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    showToast('Notificaciones', 'Se han limpiado todas las notificaciones activas.');
  };

  const handleRestoreDismissed = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDismissedIds([]);
    try {
      localStorage.removeItem('ferrestock_dismissed_notifs');
    } catch {
      // ignore
    }
    showToast('Notificaciones', 'Se han restaurado las notificaciones del sistema.');
  };

  const handleNotificationClick = (notif: SystemNotification) => {
    if (notif.view) {
      setCurrentView(notif.view);
    }
    setShowNotifications(false);
  };

  return (
    <>
      <header className="fixed top-0 left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 flex items-center justify-between px-8 shadow-[0_1px_8px_rgba(0,0,0,0.04)] select-none">
        {/* Search Bar Trigger - Hidden in Respaldo y Exportación view */}
        <div className="flex items-center gap-3">
          {!isBackupView ? (
            <div
              onClick={() => setIsSearchModalOpen(true)}
              className="h-10 px-4 rounded-xl bg-surface neo-inset flex items-center gap-2.5 text-on-surface-variant w-72 cursor-pointer hover:opacity-90 transition-opacity"
              title="Búsqueda global"
            >
              <span className="material-symbols-outlined text-[20px]">search</span>
              <span className="text-xs text-on-surface-variant font-medium select-none">
                Buscar productos, códigos...
              </span>
            </div>
          ) : (
            <div className="h-10" />
          )}
        </div>

        {/* Status Indicators & Profile */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Business / Terminal Name */}
            <div className="h-8 px-3 rounded-full bg-surface neo-raised flex items-center gap-1.5 text-xs font-semibold text-on-surface">
              <span className="material-symbols-outlined text-[16px] text-primary">storefront</span>
              <span>{APP_NAME}</span>
            </div>

            {/* Date */}
            <div className="h-8 px-3 rounded-full bg-surface neo-raised hidden xl:flex items-center gap-1.5 text-xs font-medium text-on-surface-variant capitalize">
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              <span>
                {new Intl.DateTimeFormat('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date())}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-outline-variant/50"></div>

          {/* Notifications & Profile Icon */}
          <div className="flex items-center gap-2 relative" ref={notifRef}>
            {/* Botón de la campanita */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`w-9 h-9 rounded-xl bg-surface neo-raised flex items-center justify-center transition-all relative cursor-pointer ${
                showNotifications
                  ? 'text-primary neo-inset'
                  : 'text-on-surface-variant hover:text-on-surface active:neo-inset'
              }`}
              type="button"
              title={
                activeNotifications.length > 0
                  ? `${activeNotifications.length} notificaciones del sistema`
                  : 'Notificaciones del sistema (sin alertas pendientes)'
              }
            >
              <span className="material-symbols-outlined text-[20px]">
                {activeNotifications.length > 0 ? 'notifications_active' : 'notifications'}
              </span>

              {/* Burbuja / Indicador: Únicamente visible cuando hay notificaciones reales activas */}
              {activeNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-[10px] font-bold text-white flex items-center justify-center shadow-md animate-pulse">
                  {activeNotifications.length}
                </span>
              )}
            </button>

            {/* Popover de Notificaciones */}
            {showNotifications && (
              <div className="absolute right-0 top-12 w-88 rounded-2xl bg-surface neo-raised p-4 z-50 flex flex-col gap-3 shadow-2xl border border-outline-variant/20 animate-fade-in">
                {/* Header del Popover */}
                <div className="flex items-center justify-between pb-2.5 border-b border-outline-variant/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface">Notificaciones del Sistema</span>
                    {activeNotifications.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                        {activeNotifications.length} {activeNotifications.length === 1 ? 'activa' : 'activas'}
                      </span>
                    )}
                  </div>

                  {activeNotifications.length > 0 && (
                    <button
                      onClick={handleDismissAll}
                      className="text-[11px] font-semibold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                      type="button"
                      title="Marcar todas como leídas"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Contenido / Lista de Notificaciones */}
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-0.5">
                  {activeNotifications.length === 0 ? (
                    <div className="py-7 px-3 flex flex-col items-center justify-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[22px]">check_circle</span>
                      </div>
                      <p className="text-xs font-bold text-on-surface">Sin notificaciones pendientes</p>
                      <p className="text-[11px] text-on-surface-variant max-w-[240px] leading-relaxed">
                        No hay alertas de stock, cierres pendientes ni eventos urgentes en este momento.
                      </p>
                      {dismissedIds.length > 0 && (
                        <button
                          onClick={handleRestoreDismissed}
                          className="mt-2 text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                          type="button"
                        >
                          Restaurar notificaciones anteriores
                        </button>
                      )}
                    </div>
                  ) : (
                    activeNotifications.map((n) => {
                      const iconMap = {
                        critical: { icon: 'warning', color: 'text-error', bg: 'bg-error/10' },
                        warning: { icon: 'notification_important', color: 'text-amber-600', bg: 'bg-amber-500/10' },
                        info: { icon: 'info', color: 'text-primary', bg: 'bg-primary/10' },
                        success: { icon: 'check_circle', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
                      };
                      const itemTheme = iconMap[n.type] || iconMap.info;

                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className="group p-2.5 rounded-xl bg-surface neo-inset flex items-start gap-2.5 text-xs hover:bg-surface-container-high/30 transition-all cursor-pointer relative"
                        >
                          <div
                            className={`w-7 h-7 rounded-lg ${itemTheme.bg} flex items-center justify-center shrink-0 mt-0.5`}
                          >
                            <span className={`material-symbols-outlined ${itemTheme.color} text-[16px]`}>
                              {itemTheme.icon}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-bold text-on-surface leading-tight truncate">{n.title}</p>
                              <span className="text-[9px] font-mono text-on-surface-variant shrink-0">{n.time}</span>
                            </div>
                            <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                              {n.description}
                            </p>
                            {n.actionLabel && (
                              <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-primary group-hover:underline">
                                <span>{n.actionLabel}</span>
                                <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={(e) => handleDismissOne(n.id, e)}
                            className="absolute right-2 top-2 w-5 h-5 rounded-md flex items-center justify-center text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-high cursor-pointer transition-colors"
                            type="button"
                            title="Descartar notificación"
                          >
                            <span className="material-symbols-outlined text-[13px]">close</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shadow-xs select-none"
              title="FerreStock © 2026"
            >
              <span className="material-symbols-outlined text-on-primary text-[18px]">copyright</span>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};
