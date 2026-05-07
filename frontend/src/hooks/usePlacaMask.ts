import { useState, useCallback } from 'react';

export function usePlacaMask(initialValue = '') {
  const [value, setValue] = useState(initialValue);

  const formatPlaca = useCallback((input: string): string => {
    const upper = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (upper.length === 0) return '';
    if (upper.length <= 3) return upper;
    if (upper.length === 4) {
      if (/^\d$/.test(upper[3])) {
        return upper.slice(0, 4);
      }
      return upper.slice(0, 4);
    }
    if (upper.length === 5) {
      if (upper.includes('-')) {
        return upper.slice(0, 5);
      }
      if (/^\d$/.test(upper[4])) {
        return upper.slice(0, 5);
      }
      return upper.slice(0, 5);
    }
    if (upper.length <= 7) {
      if (upper.includes('-')) {
        return upper.slice(0, 7);
      }
      return upper.slice(0, 7);
    }
    if (upper.length === 8) {
      if (upper.includes('-')) {
        return upper;
      }
      const formatted = `${upper.slice(0, 3)}-${upper.slice(3)}`;
      return formatted;
    }
    return upper.slice(0, 8);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPlaca(e.target.value);
    setValue(formatted);
  }, [formatPlaca]);

  const isValidMercosul = useCallback((placa: string): boolean => {
    return /^[A-Z]{4}[0-9][A-Z]{2}[0-9]{2}$/.test(placa);
  }, []);

  const isValidAntigo = useCallback((placa: string): boolean => {
    return /^[A-Z]{3}-[0-9]{4}$/.test(placa);
  }, []);

  const isValid = useCallback((placa: string): boolean => {
    return isValidMercosul(placa) || isValidAntigo(placa);
  }, [isValidMercosul, isValidAntigo]);

  return { 
    value, 
    setValue, 
    handleChange, 
    formatPlaca,
    isValidMercosul,
    isValidAntigo,
    isValid
  };
}