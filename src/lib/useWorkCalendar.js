import { useCallback, useEffect, useRef, useState } from 'react';
import { listCalendars, getWorkCalendarConfig, saveWorkCalendarIds, importWorkEvents } from './workCalendar';
import { withSilentAuth } from './googleCalendar';

export function useWorkCalendar(userId, gcalConnected) {
  const [calendarIds, setCalendarIds] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const initialSyncDone = useRef(false);

  // Load saved config
  useEffect(() => {
    if (!userId) return;
    getWorkCalendarConfig(userId).then(({ calendarIds: ids, lastSyncedAt: ls }) => {
      setCalendarIds(ids);
      setLastSyncedAt(ls);
    });
  }, [userId]);

  // Load available calendars (when Google connected)
  const loadAvailable = useCallback(async () => {
    if (!gcalConnected) return;
    setLoadingCalendars(true);
    setError(null);
    try {
      const cals = await listCalendars();
      setAvailableCalendars(cals);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingCalendars(false);
    }
  }, [gcalConnected]);

  const toggleCalendar = useCallback(async (calId) => {
    const next = calendarIds.includes(calId)
      ? calendarIds.filter(x => x !== calId)
      : [...calendarIds, calId];
    setCalendarIds(next);
    try { await saveWorkCalendarIds(userId, next); }
    catch (e) { setError(e.message); }
  }, [calendarIds, userId]);

  const sync = useCallback(async () => {
    if (calendarIds.length === 0) return;
    setSyncing(true);
    setError(null);
    setSummary(null);
    try {
      const s = await importWorkEvents(userId);
      setSummary(s);
      setLastSyncedAt(new Date().toISOString());
      return s;
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }, [calendarIds, userId]);

  // Auto-sync on initial connection + every 30 min
  // withSilentAuth: auto-sync never pops the consent dialog; if the token has
  // expired, fail silently and wait for the user to click "Sincronizar agora".
  useEffect(() => {
    if (!gcalConnected || calendarIds.length === 0 || !userId) return;
    if (!initialSyncDone.current) {
      initialSyncDone.current = true;
      withSilentAuth(() => importWorkEvents(userId))
        .then(() => setLastSyncedAt(new Date().toISOString()))
        .catch(() => {});
    }
    const interval = setInterval(() => {
      withSilentAuth(() => importWorkEvents(userId)).then(s => {
        if (s.newTasks > 0 || s.updatedTasks > 0) setSummary(s);
        setLastSyncedAt(new Date().toISOString());
      }).catch(e => console.warn('Work calendar poll failed (silent):', e.message));
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [gcalConnected, calendarIds, userId]);

  return {
    calendarIds,
    availableCalendars,
    lastSyncedAt,
    loadingCalendars,
    syncing,
    summary,
    error,
    loadAvailable,
    toggleCalendar,
    sync,
  };
}
