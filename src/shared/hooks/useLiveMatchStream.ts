import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '../config/firebase';

export interface LiveTeamScore {
  placementPoints: number;
  kills: number;
  totalPoints: number;
}

export interface LiveMatchData {
  currentRound: number;
  state: 'upcoming' | 'in_progress' | 'completed';
  liveScores?: Record<string, LiveTeamScore>;
  activeViewers?: number;
  lastUpdated?: number;
}

/**
 * Hook to subscribe to high-frequency live match updates from Firebase Realtime Database.
 * Prevents memory leaks with proper unsubscription teardown.
 */
export function useLiveMatchStream(tournamentId?: string) {
  const [data, setData] = useState<LiveMatchData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!tournamentId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const matchRef = ref(rtdb, `live_matches/${tournamentId}`);

    const handleData = (snapshot: any) => {
      setData(snapshot.val());
      setLoading(false);
    };

    const handleError = (err: Error) => {
      setError(err);
      setLoading(false);
    };

    onValue(matchRef, handleData, handleError);

    return () => {
      off(matchRef, 'value', handleData);
    };
  }, [tournamentId]);

  return { data, loading, error };
}
