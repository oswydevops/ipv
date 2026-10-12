import React from 'react';
import { useApp } from '../context/AppContext';
import { ViewType } from '../types';
import { APP_NAME, APP_SUBTITLE, APP_VERSION } from '../config';

interface NavItem {
  id: ViewType;
  label: string;
  icon: string;
  badge?: number;
  badgeVariant?: 'error' | 'warning';
}

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, products, sales = [], ipvTotalVendido = 0, isCurrentDayClosed, openSaleModal } = useApp();

  const lowStockCount = products.filter((p) => p.status === 'low' || p.status === 'out').length;
  const isClosePending = (sales.length > 0 || ipvTotalVendido > 0) && !isCurrentDayClosed;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard General', icon: 'dashboard' },
    { id: 'ipv-del-dia', label: 'IPV del día', icon: 'point_of_sale' },
    { id: 'historial-ventas', label: 'Historial de ventas', icon: 'receipt_long' },
    { id: 'alertas-de-stock', label: 'Alertas de stock', icon: 'notification_important', badge: lowStockCount > 0 ? lowStockCount : undefined, badgeVariant: 'error' },
    { id: 'cierre-de-caja', label: 'Cierre de caja', icon: 'lock_clock', badge: isClosePending ? 1 : undefined, badgeVariant: 'warning' },
    { id: 'reportes', label: 'Reportes', icon: 'analytics' },
    { id: 'productos', label: 'Productos', icon: 'inventory_2' },
    { id: 'respaldo-y-exportacion', label: 'Respaldo y exportación', icon: 'cloud_sync' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-surface z-50 flex flex-col justify-between p-5 shadow-[4px_0_16px_rgba(0,0,0,0.03)] select-none">
      <div className="flex flex-col gap-6">
        {/* Brand header with FerreStock Logo */}
        <div
          onClick={() => setCurrentView('dashboard')}
          className="w-full cursor-pointer flex items-center justify-center transition-transform hover:scale-[1.01] -my-1"
          title="FerreStock - Ir al Dashboard"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 800 400"
            width="100%"
            height="100%"
            className="w-full h-auto object-contain max-h-24 drop-shadow-sm"
          >
            <defs>
              {/* Gradiente Principal Azul Industrial a Eléctrico */}
              <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0052CC" />
                <stop offset="100%" stopColor="#1A73E8" />
              </linearGradient>

              {/* Gradiente Accent Naranja Mecánico */}
              <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF7A00" />
                <stop offset="100%" stopColor="#FF5500" />
              </linearGradient>

              {/* Sombra suave para dar volumen y aspecto moderno */}
              <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#001F54" floodOpacity="0.15" />
              </filter>
            </defs>

            <style>{`
              .brand-title {
                font-family: 'Montserrat', 'Inter', 'Rajdhani', 'Arial Black', sans-serif;
                font-weight: 800;
                font-size: 54px;
                fill: #1E293B;
                letter-spacing: -0.5px;
              }
              
              .brand-accent {
                fill: #0052CC;
              }

              .brand-tagline {
                font-family: 'Inter', 'Roboto', sans-serif;
                font-size: 15px;
                font-weight: 600;
                fill: #64748B;
                letter-spacing: 2px;
              }

              .badge-text {
                font-family: 'Inter', sans-serif;
                font-size: 11px;
                font-weight: 700;
                fill: #FF7A00;
                letter-spacing: 1.5px;
              }
            `}</style>

            {/* Grupo Principal del Logotipo */}
            <g transform="translate(110, 75)">
              {/* ISOTIPO (Símbolo: Engranaje + Código de Barras + Checkmark) */}
              <g transform="translate(0, 0)" filter="url(#dropShadow)">
                {/* Engranaje Base */}
                <path
                  d="
                    M 120, 20 
                    L 135, 20 L 138, 42 
                    A 110,110 0 0,1 162,52 
                    L 182, 35 L 197, 49 L 186, 71 
                    A 110,110 0 0,1 202,91 
                    L 224, 88 L 232, 107 L 213, 123 
                    A 110,110 0 0,1 216,138 
                    L 216, 210
                    A 110,110 0 0,1 198, 203
                    L 185, 185
                    A 82,82 0 0,0 188, 138
                    A 82,82 0 0,0 60, 80
                    L 60, 20 
                    Z"
                  fill="none"
                />

                {/* Silueta del Engranaje Robusto */}
                <path
                  d="
                    M 105, 20 L 135, 20 L 139, 43 A 108,108 0 0,1 163,53 L 183, 36 L 204, 57 L 187, 77 A 108,108 0 0,1 197,101 L 220, 105 L 220, 135 L 197, 139 A 108,108 0 0,1 187,163 L 204, 183 L 183, 204 L 163, 187 A 108,108 0 0,1 139,197 L 135, 220 L 105, 220 L 101, 197 A 108,108 0 0,1 77,187 L 57, 204 L 36, 183 L 53, 163 A 108,108 0 0,1 43,139 L 20, 135 L 20, 105 L 43, 101 A 108,108 0 0,1 53,77 L 36, 57 L 57, 36 L 77, 53 A 108,108 0 0,1 101,43 Z"
                  fill="url(#primaryGrad)"
                />

                {/* Centro Hueco del Engranaje (Fondo a juego con el sidebar) */}
                <circle cx="120" cy="120" r="75" fill="#e8eaf0" />

                {/* Integración del CÓDIGO DE BARRAS */}
                <g fill="url(#primaryGrad)">
                  <rect x="85" y="75" width="7" height="90" rx="3.5" />
                  <rect x="98" y="75" width="14" height="90" rx="4" />
                  <rect x="118" y="75" width="6" height="90" rx="3" />
                  <rect x="130" y="75" width="18" height="90" rx="4" />
                  <rect x="154" y="75" width="7" height="90" rx="3.5" />
                  <rect x="167" y="75" width="11" height="90" rx="4" />
                </g>

                {/* CHECKMARK DINÁMICO */}
                <path
                  d="M 70,125 L 112,167 L 212,67"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="26"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  d="M 70,125 L 112,167 L 212,67"
                  fill="none"
                  stroke="url(#accentGrad)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Punto de Conexión */}
                <circle cx="212" cy="67" r="5" fill="#FFFFFF" />
              </g>

              {/* TIPOGRAFÍA Y MARCA */}
              {/* Tag Superior / Categoría */}
              <g transform="translate(265, 82)">
                <rect x="0" y="0" width="145" height="22" rx="11" fill="#FF7A00" fillOpacity={0.12} />
                <text x="12" y="15" className="badge-text">
                  SISTEMA IPV
                </text>
              </g>

              {/* Nombre Principal "FerreStock" */}
              <text x="265" y="142" className="brand-title">
                Ferre<tspan className="brand-accent">Stock</tspan>
              </text>

              {/* Eslogan */}
              <text x="267" y="175" className="brand-tagline">
                TU INVENTARIO BAJO CONTROL
              </text>
            </g>
          </svg>
        </div>

        {/* Navigation Section */}
        <div className="px-3">
          {/* Quick Sale POS Action */}
          <button
            onClick={() => openSaleModal()}
            className="w-full py-2.5 px-3.5 mb-3.5 rounded-xl bg-primary text-white flex items-center justify-center gap-2 text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary-container active:scale-[0.98] transition-all cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">point_of_sale</span>
            <span>⚡ Nueva Venta</span>
          </button>

          <div className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant/80 mb-2">
            Operaciones Principales
          </div>
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  type="button"
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all text-left ${
                    isActive
                      ? 'bg-surface text-primary font-semibold neo-inset'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        isActive
                          ? 'bg-primary text-white shadow-sm'
                          : item.badgeVariant === 'warning'
                          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold'
                          : 'bg-error-container text-on-error-container font-bold'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User profile capsule at bottom */}
      <div className="p-3.5 rounded-xl bg-surface neo-raised flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
          <span className="material-symbols-outlined text-[18px]">person</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-on-surface leading-tight">Vendedor</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] text-on-surface-variant leading-none">{APP_VERSION}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
