/**
 * Custom hook for managing location defaults with smart auto-fill
 * After selecting the same location 3 times, it becomes the default
 */

import { useState, useEffect, useCallback } from 'react';
import type { LocationValue, LocationContext, LocationHistory } from '@/types/location';

const STORAGE_PREFIX = 'location_defaults_';

/**
 * Check if two location values are identical
 */
function areLocationsEqual(loc1: LocationValue, loc2: LocationValue): boolean {
  return (
    loc1.state === loc2.state &&
    loc1.district === loc2.district &&
    loc1.town === loc2.town
  );
}

/**
 * Check if all locations in an array are identical
 */
function areAllLocationsIdentical(locations: LocationValue[]): boolean {
  if (locations.length === 0) return false;

  const first = locations[0];
  return locations.every(loc => areLocationsEqual(loc, first));
}

/**
 * Get storage key for a specific context
 */
function getStorageKey(context: LocationContext): string {
  return `${STORAGE_PREFIX}${context}`;
}

/**
 * Load location history from localStorage
 */
function loadHistory(context: LocationContext): LocationHistory {
  try {
    const key = getStorageKey(context);
    const stored = localStorage.getItem(key);

    if (stored) {
      const parsed = JSON.parse(stored) as LocationHistory;
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load location history:', error);
  }

  return {
    history: [],
    defaults: null,
  };
}

/**
 * Save location history to localStorage
 */
function saveHistory(context: LocationContext, history: LocationHistory): void {
  try {
    const key = getStorageKey(context);
    localStorage.setItem(key, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save location history:', error);
  }
}

export type UseLocationDefaultsReturn = {
  /** Current default location (auto-fill values) */
  defaults: LocationValue | null;
  /** Record a new location selection (call after successful save) */
  recordSelection: (location: LocationValue) => void;
  /** Manually clear all history and defaults */
  clearHistory: () => void;
  /** Get the last 3 selections */
  recentSelections: LocationValue[];
};

/**
 * Hook for managing location defaults with smart auto-fill
 *
 * @param context - The context for this location selector (suppliers or invoices)
 * @returns Object with defaults and methods to record selections
 *
 * @example
 * ```tsx
 * const { defaults, recordSelection } = useLocationDefaults('suppliers');
 *
 * // Initialize form with defaults
 * const [location, setLocation] = useState(defaults || emptyLocation);
 *
 * // After successfully saving a supplier:
 * recordSelection(location);
 * ```
 */
export function useLocationDefaults(context: LocationContext): UseLocationDefaultsReturn {
  const [historyState, setHistoryState] = useState<LocationHistory>(() =>
    loadHistory(context)
  );

  // Save to localStorage whenever history changes
  useEffect(() => {
    saveHistory(context, historyState);
  }, [context, historyState]);

  /**
   * Record a new location selection
   * If the last 3 selections are identical, set them as default
   */
  const recordSelection = useCallback((location: LocationValue) => {
    setHistoryState(prev => {
      // Add new selection and keep only last 3
      const newHistory = [...prev.history, location].slice(-3);

      // Check if last 3 are identical
      let newDefaults = prev.defaults;
      if (newHistory.length === 3 && areAllLocationsIdentical(newHistory)) {
        newDefaults = location;
      }

      return {
        history: newHistory,
        defaults: newDefaults,
      };
    });
  }, []);

  /**
   * Clear all history and defaults
   */
  const clearHistory = useCallback(() => {
    setHistoryState({
      history: [],
      defaults: null,
    });
  }, []);

  return {
    defaults: historyState.defaults,
    recordSelection,
    clearHistory,
    recentSelections: historyState.history,
  };
}
