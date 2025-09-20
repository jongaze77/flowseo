'use client';

import { z } from 'zod';

// Region validation schema
export const regionSchema = z.enum(['US', 'UK', 'AU', 'CA']);

export type Region = z.infer<typeof regionSchema>;

// Region display mappings
export const REGIONS: Record<Region, { label: string; flag: string }> = {
  US: { label: 'United States', flag: '🇺🇸' },
  UK: { label: 'United Kingdom', flag: '🇬🇧' },
  AU: { label: 'Australia', flag: '🇦🇺' },
  CA: { label: 'Canada', flag: '🇨🇦' },
};

interface RegionSelectorProps {
  value: Region;
  onChange: (region: Region) => void;
  error?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function RegionSelector({
  value,
  onChange,
  error,
  label = 'Geographic Region',
  required = false,
  disabled = false,
  className = '',
}: RegionSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRegion = e.target.value as Region;
    onChange(selectedRegion);
  };

  return (
    <div className={className}>
      <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && '*'}
      </label>
      <select
        id="region"
        name="region"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
        aria-describedby={error ? 'region-error' : undefined}
      >
        {Object.entries(REGIONS).map(([code, { label, flag }]) => (
          <option key={code} value={code}>
            {flag} {label}
          </option>
        ))}
      </select>
      {error && (
        <p id="region-error" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
      <p className="mt-1 text-xs text-gray-500">
        Select the geographic region for keyword analysis and SEO data
      </p>
    </div>
  );
}