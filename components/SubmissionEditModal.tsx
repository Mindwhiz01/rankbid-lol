'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import CategoryField, { categoryChoice, categoryChoiceError, categoryPayload, type CategoryChoice } from '@/components/CategoryField';

export interface EditableSubmission {
  id: string;
  title: string;
  description: string;
  category: string;
  url?: string;
}

const inputClass =
  'w-full px-3 sm:px-4 py-2 sm:py-3 bg-white text-[#1F2937] border border-gray-300 font-semibold text-xs sm:text-sm rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F3460]/30 focus:border-[#0F3460] transition-all duration-200';

// Owner's edit form for a submission: link, title, description and category.
// Votes and sponsorships stay with the submission when the link changes; the API re-checks a new link.
export default function SubmissionEditModal({ submission, onClose, onSaved }: {
  submission: EditableSubmission;
  onClose: () => void;
  onSaved: (updated: Pick<EditableSubmission, 'id' | 'title' | 'description' | 'category' | 'url'> & { platform?: string }) => void;
}) {
  const [url, setUrl] = useState(submission.url || '');
  const [title, setTitle] = useState(submission.title);
  const [description, setDescription] = useState(submission.description || '');
  const [category, setCategory] = useState<CategoryChoice>(() => categoryChoice(submission.category));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    if (submission.url && !url.trim()) { setError('Link is required'); return; }
    const categoryProblem = categoryChoiceError(category);
    if (categoryProblem) { setError(categoryProblem); return; }
    // Only send the link when it changed: a new link is fetched and checked, which takes a moment.
    const linkChanged = Boolean(submission.url) && url.trim() !== submission.url;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/user/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: submission.id,
          ...(linkChanged ? { url: url.trim() } : {}),
          title: title.trim(),
          description: description.trim(),
          ...categoryPayload(category),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save your changes');
      onSaved(data.listing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0B2545]/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={() => !saving && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-submission-title"
        className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100">
          <h2 id="edit-submission-title" className="text-base sm:text-lg font-black text-[#1F2937]">Edit submission</h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-1.5 rounded-lg text-[#1F2937]/70 hover:bg-gray-100 hover:text-[#1F2937] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
          {submission.url && (
            <div>
              <label htmlFor="edit-url" className="block text-xs font-bold text-[#1F2937]/70 mb-1.5">Link</label>
              <input
                id="edit-url"
                type="text"
                inputMode="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                maxLength={500}
                required
                placeholder="https://yourproduct.com"
                className={inputClass}
              />
              <p className="text-[11px] text-[#1F2937]/70 mt-1">
                Your votes and clicks stay with this submission. A new link is checked the same way as a new submission.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="edit-title" className="block text-xs font-bold text-[#1F2937]/70 mb-1.5">Title</label>
            <input id="edit-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required className={inputClass} />
          </div>

          <div>
            <label htmlFor="edit-description" className="block text-xs font-bold text-[#1F2937]/70 mb-1.5">Description</label>
            <textarea id="edit-description" value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={4} className={`${inputClass} resize-none`} />
            <p className="text-[11px] text-[#1F2937]/70 mt-1 text-right tabular-nums">{description.length}/500</p>
          </div>

          <div>
            <p className="block text-xs font-bold text-[#1F2937]/70 mb-1.5">Category</p>
            {/* Older listings may carry a category the form no longer offers; keep it selectable. */}
            <CategoryField value={category} onChange={setCategory} extraOptions={[submission.category]} />
          </div>

          {error && <p role="alert" className="text-xs font-bold text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg border border-gray-300 text-xs sm:text-sm font-bold text-[#1F2937]/70 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-[#0F3460] text-white text-xs sm:text-sm font-black hover:bg-[#0D2A50] disabled:opacity-50 transition-colors">
              {saving ? (submission.url && url.trim() !== submission.url ? 'Checking link…' : 'Saving…') : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
