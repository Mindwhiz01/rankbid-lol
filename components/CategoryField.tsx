'use client';

import { useEffect, useId, useState } from 'react';
import CategorySelect from '@/components/CategorySelect';
import { CATEGORIES, cleanCustomCategory, getCategoryLabel } from '@/lib/categories';

/** What the picker holds: a category, plus a typed name when "Other" is picked with the box ticked. */
export interface CategoryChoice {
  category: string;
  addCustom: boolean;
  customName: string;
}

export const EMPTY_CATEGORY: CategoryChoice = { category: '', addCustom: false, customName: '' };

export const categoryChoice = (category = ''): CategoryChoice => ({ ...EMPTY_CATEGORY, category });

/** Fields for /api/listings/submit and /api/user/submissions. */
export function categoryPayload(choice: CategoryChoice): { category: string; customCategory?: string } {
  return choice.category === 'Other' && choice.addCustom && choice.customName.trim()
    ? { category: 'Other', customCategory: choice.customName.trim() }
    : { category: choice.category };
}

/** Why the choice can't be submitted, or null. */
export function categoryChoiceError(choice: CategoryChoice): string | null {
  if (!choice.category) return 'Please select a category';
  if (choice.category === 'Other' && choice.addCustom) {
    if (!choice.customName.trim()) return 'Type your category name, or untick the box';
    if (!cleanCustomCategory(choice.customName)) return 'Use 2-30 letters or numbers for the category name';
  }
  return null;
}

// Categories people added, fetched once per page load and shared by every picker.
let customRequest: Promise<string[]> | null = null;
function loadCustomCategories(): Promise<string[]> {
  customRequest ??= fetch('/api/categories')
    .then(r => (r.ok ? r.json() : { custom: [] }))
    .then(d => (Array.isArray(d.custom) ? d.custom : []))
    .catch(() => {
      customRequest = null;
      return [];
    });
  return customRequest;
}

/**
 * Category picker for the submit forms. Built-in categories, then ones people added, then "Other";
 * picking "Other" offers a box to name a new category, which is saved for everyone once submitted.
 */
export default function CategoryField({ value, onChange, invalid, extraOptions = [] }: {
  value: CategoryChoice;
  onChange: (next: CategoryChoice) => void;
  invalid?: boolean;
  /** Extra values to offer, e.g. a legacy category an existing listing still has. */
  extraOptions?: string[];
}) {
  const [custom, setCustom] = useState<string[]>([]);
  const checkboxId = useId();
  useEffect(() => {
    let live = true;
    loadCustomCategories().then(names => { if (live) setCustom(names); });
    return () => { live = false; };
  }, []);

  const builtIn = CATEGORIES.filter(c => c !== 'Other');
  const values = [...new Set([...builtIn, ...custom, ...extraOptions.filter(Boolean), 'Other'])];
  const options = values.map(v => ({ value: v, label: getCategoryLabel(v) }));
  const other = value.category === 'Other';

  return (
    <div>
      <CategorySelect
        value={value.category}
        onChange={category => onChange({ ...value, category })}
        options={options}
        invalid={invalid && !(other && value.addCustom)}
      />
      {other && (
        <div className="mt-2 space-y-2">
          <label htmlFor={checkboxId} className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#1F2937]/75 cursor-pointer select-none">
            <input
              id={checkboxId}
              type="checkbox"
              checked={value.addCustom}
              onChange={e => onChange({ ...value, addCustom: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 accent-[#0F3460]"
            />
            My category isn&apos;t listed. Add it
          </label>
          {value.addCustom && (
            <input
              type="text"
              value={value.customName}
              onChange={e => onChange({ ...value, customName: e.target.value })}
              placeholder="Category name, e.g. Pet Care"
              maxLength={30}
              autoFocus
              aria-label="New category name"
              aria-invalid={invalid || undefined}
              className={`w-full px-3 sm:px-4 py-2 sm:py-3 bg-white text-[#1F2937] border font-semibold text-xs sm:text-sm rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F3460]/30 focus:border-[#0F3460] transition-all duration-200 ${
                invalid ? 'border-red-500 shake' : 'border-gray-300'
              }`}
            />
          )}
        </div>
      )}
    </div>
  );
}
