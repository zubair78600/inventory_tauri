/**
 * LocationSelector Component
 * Cascading dropdowns for State, District, and Town selection
 * Includes smart defaults that auto-fill after 3 identical selections
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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
 * LocationSelector component with cascading State > District > Town dropdowns
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
      town: '', // Reset town when state changes
    });
  };

  // Handle district change
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...value,
      district: e.target.value,
    });
  };

  // Handle town change
  const handleTownChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      town: e.target.value,
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* State Dropdown */}
        <div>
          <label className="form-label block text-sm font-medium text-slate-700 mb-1.5">
            State <span className="text-red-500">*</span>
          </label>
          <Select
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
          </Select>
        </div>

        {/* District Dropdown */}
        <div>
          <label className="form-label block text-sm font-medium text-slate-700 mb-1.5">
            District <span className="text-red-500">*</span>
          </label>
          <Select
            value={value.district}
            onChange={handleDistrictChange}
            disabled={disabled || !value.state}
            required
          >
            <option value="">
              {value.state ? 'Select District' : 'Select a state first'}
            </option>
            {availableDistricts.map(district => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </Select>
        </div>

        {/* Town Input */}
        <div>
          <label className="form-label block text-sm font-medium text-slate-700 mb-1.5">
            Town / City
          </label>
          <Input
            value={value.town}
            onChange={handleTownChange}
            disabled={disabled}
            placeholder="Enter town or city name"
            type="text"
          />
        </div>
      </div>
      {!value.state && (
        <p className="mt-2 text-xs text-slate-500">
          Please select a state first to enable district selection
        </p>
      )}
    </div>
  );
}
