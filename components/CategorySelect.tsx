'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface Option {
  value: string;
  label: string;
}

// Themed replacement for a native <select>: the browser's option popup can't be rounded or
// recoloured, so this renders its own listbox. Keyboard: arrows/Home/End move, Enter/Space
// picks, Escape closes, typing a letter jumps to the next matching option.
export default function CategorySelect({ value, onChange, options, placeholder = 'Select category', invalid }: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const openList = () => {
    setActive(Math.max(0, options.findIndex(o => o.value === value)));
    setOpen(true);
  };

  const pick = (i: number) => {
    onChange(options[i].value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive(i => Math.min(options.length - 1, i + 1)); break;
      case 'ArrowUp': e.preventDefault(); setActive(i => Math.max(0, i - 1)); break;
      case 'Home': e.preventDefault(); setActive(0); break;
      case 'End': e.preventDefault(); setActive(options.length - 1); break;
      case 'Enter':
      case ' ': e.preventDefault(); pick(active); break;
      case 'Escape': e.preventDefault(); setOpen(false); break;
      case 'Tab': setOpen(false); break;
      default:
        if (e.key.length === 1) {
          const ch = e.key.toLowerCase();
          for (let n = 1; n <= options.length; n++) {
            const i = (active + n) % options.length;
            if (options[i].label.toLowerCase().startsWith(ch)) { setActive(i); break; }
          }
        }
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-2 sm:py-3 bg-white border font-semibold text-xs sm:text-sm rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-[#0F3460]/30 focus:border-[#0F3460] transition-all duration-200 ${
          open ? 'border-[#0F3460] ring-2 ring-[#0F3460]/30' : invalid ? 'border-red-500 shake' : 'border-gray-300'
        } ${selected ? 'text-[#1F2937]' : 'text-gray-400'}`}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <svg className={`w-4 h-4 shrink-0 text-[#0F3460] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-30 max-h-72 overflow-y-auto py-1.5 bg-white rounded-xl shadow-2xl shadow-[#0F3460]/20 border border-gray-200"
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(i)}
                className={`mx-1.5 flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#0F3460] text-white' : i === active ? 'bg-[#0F3460]/[0.07] text-[#0F3460]' : 'text-[#1F2937]'
                }`}
              >
                <span>{option.label}</span>
                {isSelected && (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.58l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
