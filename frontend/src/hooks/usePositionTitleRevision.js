import { useEffect, useState } from 'react';
import { POSITION_TITLES_CHANGED_EVENT } from '../services/positionService';

export function usePositionTitleRevision() {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    function handleChange() {
      setRevision((value) => value + 1);
    }

    window.addEventListener(POSITION_TITLES_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(POSITION_TITLES_CHANGED_EVENT, handleChange);
  }, []);

  return revision;
}
