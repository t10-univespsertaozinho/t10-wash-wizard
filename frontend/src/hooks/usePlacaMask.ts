import { useState, useCallback } from 'react';

export function usePlacaMask(initialValue = '') {
  const [value, setValue] = useState(initialValue);

  const formatPlaca = useCallback((input: string): string => {
    const upper = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return upper.slice(0, 8);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPlaca(e.target.value);
    setValue(formatted);
  }, [formatPlaca]);

  const isValidMercosul = useCallback((placa: string): boolean => {
    return /^[A-Z]{4}\d[A-Z]{2}\d{2}$/.test(placa);
  }, []);

  const isValidAntigo = useCallback((placa: string): boolean => {
    return /^[A-Z]{3}\d{4}$/.test(placa);
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