import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import {
  requestToken, findOrCreateCalendar, syncAll, disconnect, withSilentAuth,
  cleanupCalendarDuplicates,
} from './googleCalendar';
import { importFromClassroom } from './classroom';

export function useGoogleCalendar(userId, currentState) {
  const [calendarId, setCalendarId] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [classroomLastSyncedAt, setClassroomLastSyncedAt] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importingClassroom, setImportingClassroom] = useState(false);
  const [classroomSummary, setClassroomSummary] = useState(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null); // last deletedCount
  const [error, setError] = useState(null);
  const stateRef = useRef(currentState);

  useEffect(() => { stateRef.current = currentState; }, [currentState]);

  // Load profile data
  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles')
      .select('google_calendar_id, google_last_synced_at, classroom_last_synced_at')
      .eq('id', userId).single()
      .then(({ data }) => {
        if (data) {
          setCalendarId(data.google_calendar_id);
          setLastSyncedAt(data.google_last_synced_at);
          setClassroomLastSyncedAt(data.classroom_last_synced_at);
        }
      });
  }, [userId]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await requestToken('consent');
      const id = await findOrCreateCalendar();
      await supabase.from('profiles').update({
        google_calendar_id: id,
        google_connected_at: new Date().toISOString(),
      }).eq('id', userId);
      setCalendarId(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  }, [userId]);

  const sync = useCallback(async (state) => {
    if (!calendarId) return;
    setSyncing(true);
    setError(null);
    try {
      const count = await syncAll(state || stateRef.current, calendarId, userId);
      setLastSyncedAt(new Date().toISOString());
      return count;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setSyncing(false);
    }
  }, [calendarId, userId]);

  const importClassroom = useCallback(async () => {
    if (!calendarId) return; // need to be connected to Google first
    setImportingClassroom(true);
    setError(null);
    setClassroomSummary(null);
    try {
      const summary = await importFromClassroom(userId, stateRef.current);
      setClassroomLastSyncedAt(new Date().toISOString());
      setClassroomSummary(summary);
      return summary;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setImportingClassroom(false);
    }
  }, [calendarId, userId]);

  const disconnectCalendar = useCallback(async () => {
    await disconnect(userId);
    setCalendarId(null);
    setLastSyncedAt(null);
    setClassroomLastSyncedAt(null);
  }, [userId]);

  // Scan the Organizador calendar and delete duplicate events.
  // Safe to run any time — it only deletes, never creates.
  const cleanup = useCallback(async () => {
    if (!calendarId) return;
    setCleaningUp(true);
    setError(null);
    setCleanupResult(null);
    try {
      const n = await cleanupCalendarDuplicates(calendarId);
      setCleanupResult(n);
      return n;
    } catch (e) {
      setError(e.message);
    } finally {
      setCleaningUp(false);
    }
  }, [calendarId]);

  // ---- Auto-sync to Calendar INTENTIONALLY REMOVED ------------------------
  // Pushing tasks to the Google Calendar only happens when the user clicks
  // "Sincronizar" in the account modal. Auto-syncing on every state change
  // created duplicate events: the state didn't immediately reflect the newly
  // issued google_event_id, so concurrent syncs could CREATE instead of UPDATE.
  // Explicit user action is the right UX and avoids that whole class of bugs.

  // ---- Initial + polling Classroom every 15min while app open -----------
  // Also silent — user clicks "Importar Classroom agora" to do an interactive run.
  const initialClassroomDone = useRef(false);
  useEffect(() => {
    if (!calendarId || !userId) return;
    const runImport = () => withSilentAuth(() => importFromClassroom(userId, stateRef.current))
      .then(s => {
        setClassroomSummary(s);
        setClassroomLastSyncedAt(new Date().toISOString());
      })
      .catch(e => console.warn('Classroom sync failed (silent):', e.message));

    if (!initialClassroomDone.current) {
      initialClassroomDone.current = true;
      runImport();
    }
    const interval = setInterval(runImport, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [calendarId, userId]);

  return {
    connected: !!calendarId,
    calendarId,
    lastSyncedAt,
    classroomLastSyncedAt,
    connecting,
    syncing,
    importingClassroom,
    classroomSummary,
    cleaningUp,
    cleanupResult,
    error,
    connect,
    sync,
    importClassroom,
    cleanup,
    disconnect: disconnectCalendar,
  };
}
