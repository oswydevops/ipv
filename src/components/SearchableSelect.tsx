import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  className?: string;
  containerClassName?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

const normalizeSearchText = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder,
  ariaLabel = placeholder,
  className = '',
  containerClassName = 'w-full',
  disabled = false,
  emptyMessage = 'No se encontraron opciones',
}) => {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim());
    if (!normalizedQuery) return options;
    return options.filter((option) => normalizeSearchText(option.label).includes(normalizedQuery));
  }, [options, query]);
  const visibleOptions = filteredOptions.slice(0, 100);

  useEffect(() => {
    if (isOpen) {
      document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, id, isOpen, visibleOptions.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const selectOption = (option: SearchableSelectOption) => {
    onChange(option.value);
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        setQuery('');
        setIsOpen(true);
        setActiveIndex(0);
        return;
      }
      setActiveIndex((current) => {
        if (visibleOptions.length === 0) return 0;
        if (event.key === 'ArrowDown') return Math.min(current + 1, visibleOptions.length - 1);
        return Math.max(current - 1, 0);
      });
    } else if (event.key === 'Home' && isOpen && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End' && isOpen && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex(visibleOptions.length - 1);
    } else if (event.key === 'Enter' && isOpen) {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) selectOption(option);
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      setQuery('');
    } else if (event.key === 'Tab') {
      setIsOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      <input
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={isOpen && visibleOptions[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={isOpen ? query : selectedOption?.label || ''}
        onFocus={() => {
          if (!isOpen) {
            setQuery('');
            setActiveIndex(0);
            setIsOpen(true);
          }
        }}
        onClick={() => {
          if (!isOpen) {
            setQuery('');
            setActiveIndex(0);
            setIsOpen(true);
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
            setIsOpen(false);
            setQuery('');
          }
        }}
        placeholder={placeholder}
        className={`w-full pl-3 pr-9 rounded-xl bg-surface neo-inset text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      />
      <span
        className={`material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant transition-transform ${isOpen ? 'rotate-180' : ''}`}
        aria-hidden="true"
      >
        expand_more
      </span>

      {isOpen && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="searchable-select-options absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface neo-raised p-1 shadow-xl"
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-on-surface-variant">{emptyMessage}</div>
          ) : (
            <>
              {visibleOptions.map((option, index) => (
                <div
                  key={option.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                  className={`cursor-pointer rounded-lg px-3 py-2 text-xs transition-colors ${
                    index === activeIndex
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  {option.label}
                </div>
              ))}
              {filteredOptions.length > visibleOptions.length && (
                <div className="px-3 py-2 text-[10px] text-on-surface-variant">
                  {filteredOptions.length - visibleOptions.length} resultados más; escribe para filtrar.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
