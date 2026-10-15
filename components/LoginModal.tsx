'use client';

import Link from 'next/link';
import { X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export default function LoginModal({ isOpen, onClose, title = 'Login Required' }: LoginModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[#0B2545]/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border-t-4 border-[#0F3460]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-2 rounded-lg text-gray-400 hover:text-[#0F3460] hover:bg-[#0F3460]/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h2 id="login-modal-title" className="text-2xl font-black text-[#0F3460] mb-2 pr-8">{title}</h2>

        {/* Message */}
        <p className="text-gray-600 mb-8">
          You need to be logged in to submit your product and vote.
        </p>

        {/* Buttons */}
        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full px-6 py-3 bg-[#0F3460] text-white font-bold rounded-lg hover:bg-[#0D2A50] transition-colors text-center"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="block w-full px-6 py-3 bg-white text-[#0F3460] font-bold rounded-lg border-2 border-[#0F3460] hover:bg-[#0F3460]/5 transition-colors text-center"
          >
            Create Account
          </Link>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-500 font-semibold">OR</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Continue as Guest */}
        <button
          type="button"
          onClick={onClose}
          className="w-full px-6 py-2 text-[#0F3460] font-semibold rounded-lg hover:bg-[#0F3460]/5 transition-colors"
        >
          Continue as Guest
        </button>
      </div>
    </div>
  );
}
