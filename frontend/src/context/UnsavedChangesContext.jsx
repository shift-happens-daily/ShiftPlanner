import { useCallback, useEffect, useMemo, useState } from 'react';
import { UnsavedChangesContext } from './unsaved-changes-context';

export const UNSAVED_CHANGES_MESSAGE = 'Изменения не сохранены';

export function UnsavedChangesProvider({ children }) {
  const [dirtyScopes, setDirtyScopes] = useState(() => new Set());

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
    return window.confirm(UNSAVED_CHANGES_MESSAGE);
  }, [dirtyScopes]);

  useEffect(() => {
    if (!isDirty) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = UNSAVED_CHANGES_MESSAGE;
      return UNSAVED_CHANGES_MESSAGE;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const value = useMemo(() => ({
    isDirty,
    message: UNSAVED_CHANGES_MESSAGE,
    markUnsaved,
    markSaved,
    resetUnsavedChanges,
    confirmDiscardChanges,
  }), [confirmDiscardChanges, isDirty, markSaved, markUnsaved, resetUnsavedChanges]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}
