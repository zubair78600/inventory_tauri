/**
 * LocationSelector Component
 * Cascading dropdowns for State and District selection
 * Includes smart defaults that auto-fill after 3 identical selections
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import type { LocationData, LocationValue } from '@/types/location';

type LocationSelectorProps = {
  /** Current location value */
  value: LocationValue;
  /** Callback when location changes */
  onChange: (value: LocationValue) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional CSS class for the container */
  className?: string;
};

/**
 * LocationSelector component with cascading State > District dropdowns
 *
 * @example
 * ```tsx
 * <LocationSelector
 *   value={location}
 *   onChange={setLocation}
 *   disabled={isSubmitting}
 * />
 * ```
 */
export function LocationSelector({
  value,
  onChange,
  disabled = false,
  className = '',
}: LocationSelectorProps) {
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load location data from JSON file
  useEffect(() => {
    fetch('/data/states-districts.json')
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to load location data');
        }
        return res.json();
      })
      .then((data: LocationData) => {
        setLocationData(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load location data:', err);
        setError('Failed to load location data');
        setIsLoading(false);
      });
  }, []);

  // Get available districts for the selected state
  const availableDistricts = useMemo(() => {
    if (!value.state || !locationData) return [];

    const state = locationData.states.find(s => s.state === value.state);
    return state?.districts || [];
  }, [value.state, locationData]);

  // Handle state change
  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      state: e.target.value,
      district: '', // Reset district when state changes
      town: '', // Keep town empty
    });
  };

  // Handle district change
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...value,
      district: e.target.value,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-sm text-slate-500">Loading location data...</div>
      </div>
    );
  }

  // Error state
  if (error || !locationData) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-sm text-red-500">
          {error || 'Failed to load location data'}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* State Dropdown */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">
            State <span className="text-red-500">*</span>
          </label>
          <select
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm shadow-black/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            value={value.state}
            onChange={handleStateChange}
            disabled={disabled}
            required
          >
            <option value="">Select State</option>
            {locationData.states.map(({ state }) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        {/* District Dropdown */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">
            District <span className="text-red-500">*</span>
          </label>
          <select
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm shadow-black/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            value={value.district}
            onChange={handleDistrictChange}
            disabled={disabled || !value.state}
            required
          >
            <option value="">
              {value.state ? 'Select District' : 'Select State First'}
            </option>
            {availableDistricts.map(district => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </div>

        {/* Town Input */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">
            Town <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm shadow-black/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            value={value.town}
            onChange={(e) => onChange({ ...value, town: e.target.value })}
            placeholder="Enter Town"
            disabled={disabled}
            required
          />
        </div>
      </div>
      {!value.state && (
        <p className="mt-1 text-[10px] text-slate-400">
          * Select state first
        </p>
      )}
    </div>
  );
}
