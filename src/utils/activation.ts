export const ACTIVATION_CODE_MIN_LENGTH = 100;
export const ACTIVATION_CODE_LENGTH = 124;

export const normalizeActivationCode = (code: string): string =>
  (code || '').replace(/[\s-]/g, '').toUpperCase();

export const formatActivationCode = (code: string): string => {
  const normalized = normalizeActivationCode(code);
  return normalized.match(/.{1,5}/g)?.join('-') || '';
};
