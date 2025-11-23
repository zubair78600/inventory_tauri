/**
 * Location data types for Indian states, districts, and towns
 */

export type LocationData = {
  states: Array<{
    state: string;
    districts: string[];
  }>;
};

export type LocationValue = {
  state: string;
  district: string;
  town: string;
};

export type LocationHistory = {
  history: LocationValue[];
  defaults: LocationValue | null;
};

export type LocationContext = 'suppliers' | 'invoices';
