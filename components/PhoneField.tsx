'use client';

// Phone input with a country picker: the dial code comes from the dropdown, the visitor types the rest.

export interface Country {
  code: string;
  name: string;
  dial: string;
  /** Sample local number shown as the placeholder. */
  example: string;
}

export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States', dial: '+1', example: '(201) 555-0123' },
  { code: 'CA', name: 'Canada', dial: '+1', example: '(506) 234-5678' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', example: '7400 123456' },
  { code: 'AU', name: 'Australia', dial: '+61', example: '412 345 678' },
  { code: 'IE', name: 'Ireland', dial: '+353', example: '85 012 3456' },
  { code: 'NZ', name: 'New Zealand', dial: '+64', example: '21 123 4567' },
  { code: 'DE', name: 'Germany', dial: '+49', example: '1512 3456789' },
  { code: 'FR', name: 'France', dial: '+33', example: '6 12 34 56 78' },
  { code: 'ES', name: 'Spain', dial: '+34', example: '612 34 56 78' },
  { code: 'IT', name: 'Italy', dial: '+39', example: '312 345 6789' },
  { code: 'NL', name: 'Netherlands', dial: '+31', example: '6 12345678' },
  { code: 'SE', name: 'Sweden', dial: '+46', example: '70 123 45 67' },
  { code: 'CH', name: 'Switzerland', dial: '+41', example: '78 123 45 67' },
  { code: 'PT', name: 'Portugal', dial: '+351', example: '912 345 678' },
  { code: 'PL', name: 'Poland', dial: '+48', example: '512 345 678' },
  { code: 'TR', name: 'Turkey', dial: '+90', example: '501 234 56 78' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', example: '50 123 4567' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', example: '51 234 5678' },
  { code: 'QA', name: 'Qatar', dial: '+974', example: '3312 3456' },
  { code: 'IN', name: 'India', dial: '+91', example: '81234 56789' },
  { code: 'PK', name: 'Pakistan', dial: '+92', example: '301 2345678' },
  { code: 'BD', name: 'Bangladesh', dial: '+880', example: '1812 345678' },
  { code: 'SG', name: 'Singapore', dial: '+65', example: '8123 4567' },
  { code: 'MY', name: 'Malaysia', dial: '+60', example: '12 345 6789' },
  { code: 'ID', name: 'Indonesia', dial: '+62', example: '812 3456 789' },
  { code: 'PH', name: 'Philippines', dial: '+63', example: '905 123 4567' },
  { code: 'JP', name: 'Japan', dial: '+81', example: '90 1234 5678' },
  { code: 'KR', name: 'South Korea', dial: '+82', example: '10 2000 0000' },
  { code: 'CN', name: 'China', dial: '+86', example: '131 2345 6789' },
  { code: 'BR', name: 'Brazil', dial: '+55', example: '11 96123 4567' },
  { code: 'MX', name: 'Mexico', dial: '+52', example: '222 123 4567' },
  { code: 'AR', name: 'Argentina', dial: '+54', example: '9 11 2345 6789' },
  { code: 'ZA', name: 'South Africa', dial: '+27', example: '71 123 4567' },
  { code: 'NG', name: 'Nigeria', dial: '+234', example: '802 123 4567' },
  { code: 'EG', name: 'Egypt', dial: '+20', example: '100 123 4567' },
  { code: 'KE', name: 'Kenya', dial: '+254', example: '712 123456' },
];

const flag = (code: string) => String.fromCodePoint(...[...code].map(c => 0x1f1a5 + c.charCodeAt(0)));

/** "+1 (201) 555-0123": the full number the server stores. Empty when no digits were typed. */
export function fullPhone(countryCode: string, local: string): string {
  const country = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0];
  const digits = local.trim().replace(/^0+/, '');
  return digits ? `${country.dial} ${digits}` : '';
}

export default function PhoneField({ country, onCountryChange, value, onChange, required, className = '' }: {
  country: string;
  onCountryChange: (code: string) => void;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  const current = COUNTRIES.find(c => c.code === country) ?? COUNTRIES[0];
  return (
    <div className={`flex w-full bg-white border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#0F3460]/20 focus-within:border-[#0F3460] transition ${className}`}>
      {/* Closed, it shows just the flag and code; the native list (with country names) opens on click. */}
      <label className="relative shrink-0 flex items-center gap-1 pl-3 pr-2 text-sm text-[#1F2937] border-r border-gray-200 cursor-pointer">
        <span aria-hidden="true">{flag(current.code)}</span>
        <span className="font-semibold tabular-nums">{current.dial}</span>
        <svg aria-hidden="true" className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
        <select
          aria-label="Country code"
          value={current.code}
          onChange={e => onCountryChange(e.target.value)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        >
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{flag(c.code)} {c.name} ({c.dial})</option>
          ))}
        </select>
      </label>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9 ()-]/g, '').slice(0, 20))}
        required={required}
        placeholder={current.example}
        className="min-w-0 flex-1 px-3 py-3 text-sm text-[#1F2937] bg-transparent placeholder-gray-400 rounded-r-xl focus:outline-none"
      />
    </div>
  );
}
