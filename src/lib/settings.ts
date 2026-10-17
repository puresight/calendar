import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'ilc-setting-';

export const SHOW_BIRTHDAYS_KEY = 'show-contact-milestones';

export function useBooleanSetting(
  key: string,
  defaultValue: boolean
): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    const stored = localStorage.getItem(PREFIX + key);
    return stored === null ? defaultValue : stored === '1';
  });

  useEffect(() => {
    localStorage.setItem(PREFIX + key, value ? '1' : '0');
  }, [key, value]);

  const update = useCallback((v: boolean) => setValue(v), []);
  return [value, update];
}
