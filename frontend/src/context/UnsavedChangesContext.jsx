import { useCallback, useEffect, useMemo, useState } from 'react';
import { UnsavedChangesContext } from './unsaved-changes-context';

const UNSAVED_MESSAGES = {
  ru: 'Изменения не сохранены',
  en: 'Unsaved changes',
};

export const UNSAVED_CHANGES_MESSAGE = UNSAVED_MESSAGES.ru;

function getUnsavedMessage(language) {
  return UNSAVED_MESSAGES[language] || UNSAVED_MESSAGES.ru;
}

export function UnsavedChangesProvider({ children, language = 'ru' }) {
  const [dirtyScopes, setDirtyScopes] = useState(() => new Set());
  const message = useMemo(() => getUnsavedMessage(language), [language]);

  const isDirty = dirtyScopes.size > 0;

  const markUnsaved = useCallback((scope = 'default') => {
    setDirtyScopes((current) => {
      if (current.has(scope)) return current;
      const next = new Set(current);
      next.add(scope);
      return next;
    });
  }, []);

  const markSaved = useCallback((scope = 'default') => {
    setDirtyScopes((current) => {
      if (!current.has(scope)) return current;
      const next = new Set(current);
      next.delete(scope);
      return next;
    });
  }, []);

  const resetUnsavedChanges = useCallback(() => {
    setDirtyScopes((current) => (current.size === 0 ? current : new Set()));
  }, []);

  const confirmDiscardChanges = useCallback(() => {
    if (dirtyScopes.size === 0) return true;
    return window.confirm(message);
  }, [dirtyScopes, message]);

  useEffect(() => {
    if (!isDirty) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, message]);

  const value = useMemo(() => ({
    isDirty,
    message,
    markUnsaved,
    markSaved,
    resetUnsavedChanges,
    confirmDiscardChanges,
  }), [confirmDiscardChanges, isDirty, markSaved, markUnsaved, message, resetUnsavedChanges]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}
