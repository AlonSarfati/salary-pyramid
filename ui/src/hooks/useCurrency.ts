import { useState, useEffect } from 'react';
import { tenantApi } from '../services/apiService';
import type { Currency } from '../utils/currency';

/**
 * Hook to get the currency for a specific tenant
 */
export function useCurrency(tenantId: string): Currency {
  const [currency, setCurrency] = useState<Currency>('USD');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tenant = await tenantApi.get(tenantId);
        if (!cancelled && tenant.currency) {
          setCurrency(tenant.currency as Currency);
        }
      } catch (error) {
        console.error('Failed to load tenant currency:', error);
        // Default to USD on error
        if (!cancelled) {
          setCurrency('USD');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  return currency;
}

