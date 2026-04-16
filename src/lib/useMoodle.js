import { useCallback, useEffect, useRef, useState } from 'react';
import { getMoodleUrl, saveMoodleUrl, importFromMoodle } from './moodle';

export function useMoodle(userId, currentState) {
  const [url, setUrl] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const stateRef = useRef(currentState);

  useEffect(() => { stateRef.current = currentState; }, [currentState]);

  useEffect(() => {
    if (!userId) return;
    getMoodleUrl(userId).then(({ moodle_ical_url, moodle_last_synced_at }) => {
      if (moodle_ical_url) setUrl(moodle_ical_url);
      if (moodle_last_synced_at) setLastSyncedAt(moodle_last_synced_at);
    });
  }, [userId]);

  const saveUrl = useCallback(async (newUrl) => {
    setError(null);
    try {
      await saveMoodleUrl(userId, newUrl);
      setUrl(newUrl);
    } catch (e) {
      setError(e.message);
    }
  }, [userId]);

  const sync = useCallback(async () => {
    if (!url) return;
    setSyncing(true);
    setError(null);
    setSummary(null);
    try {
      const s = await importFromMoodle(userId, stateRef.current);
      setSummary(s);
      setLastSyncedAt(new Date().toISOString());
      return s;
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }, [url, userId]);

  // Auto-sync every 30min while app open
  useEffect(() => {
    if (!url || !userId) return;
    const interval = setInterval(() => {
      importFromMoodle(userId, stateRef.current)
        .then(s => {
          if (s.newTasks > 0 || s.newExams > 0) setSummary(s);
          setLastSyncedAt(new Date().toISOString());
        })
        .catch(e => console.warn('Moodle poll failed:', e.message));
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [url, userId]);

  return {
    url,
    configured: !!url,
    lastSyncedAt,
    syncing,
    summary,
    error,
    saveUrl,
    sync,
  };
}
