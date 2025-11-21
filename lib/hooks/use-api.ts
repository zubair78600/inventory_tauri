/**
 * Custom hook for making API calls with proper error handling
 */

import { useCallback, useState } from 'react';

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

type UseApiReturn<T, P extends unknown[]> = ApiState<T> & {
  execute: (...args: P) => Promise<T | null>;
  reset: () => void;
};

export function useApi<T, P extends unknown[]>(
  apiFunction: (...args: P) => Promise<T>
): UseApiReturn<T, P> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: P): Promise<T | null> => {
      try {
        setState({ data: null, loading: true, error: null });
        const response = await apiFunction(...args);
        setState({ data: response, loading: false, error: null });
        return response;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setState({ data: null, loading: false, error: err });
        return null;
      }
    },
    [apiFunction]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}
