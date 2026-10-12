import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';

export const SearchModal: React.FC = () => {
  const {
    isSearchModalOpen,
    setIsSearchModalOpen,
    products,
    setSelectedProductId,
    setCurrentView,
  } = useApp();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchModalOpen) {
        setIsSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen, setIsSearchModalOpen]);

  useEffect(() => {
    if (isSearchModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isSearchModalOpen]);

  if (!isSearchModalOpen) return null;

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.code.toLowerCase().includes(query.toLowerCase()) ||
      p.category.toLowerCase().includes(query.toLowerCase()) ||
      p.detail.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    setCurrentView('productos');
    setIsSearchModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-surface neo-raised p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface neo-inset flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]">search</span>
          </div>
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código, nombre, categoría o especificación..."
              className="w-full bg-transparent border-none outline-none text-sm font-semibold text-on-surface placeholder:text-on-surface-variant/60"
            />
          </div>
          <button
            onClick={() => setIsSearchModalOpen(false)}
            className="w-8 h-8 rounded-lg bg-surface neo-raised flex items-center justify-center text-on-surface-variant hover:text-on-surface active:neo-inset"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto flex flex-col gap-2 pt-2 border-t border-outline-variant/20">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-on-surface-variant">
              No se encontraron coincidencias para &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectProduct(item.id)}
                className="p-3 rounded-xl bg-surface hover:bg-surface-container-high transition-colors cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded bg-surface neo-inset font-mono text-[11px] font-bold text-primary">
                    {item.code}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      {item.category} • {item.detail}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-on-surface font-mono">
                      ${item.price.toFixed(2)} CUP
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${
                        item.stock === 0
                          ? 'text-error'
                          : item.stock <= item.minStock
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {item.stock} {item.um}s
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-primary transition-colors">
                    chevron_right
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-2 border-t border-outline-variant/20">
          <span>
            Mostrando <strong>{filtered.length}</strong> resultados en base local SQLite
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface neo-inset">
            [ESC] para cerrar
          </span>
        </div>
      </div>
    </div>
  );
};
