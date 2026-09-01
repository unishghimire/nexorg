import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '../config/firebase';

export interface LiveTournamentSyncData {
  status: 'draft' | 'registration_open' | 'registration_closed' | 'upcoming' | 'live' | 'completed' | 'cancelled';
  currentRound?: number;
  totalParticipants?: number;
  groups?: Record<string, { lobbyStatus: string; assignedTeams?: string[]; updatedAt?: number }>;
  updatedAt?: number;
}

/**
 * Hook to subscribe to sub-second tournament lifecycle and lobby state updates from Realtime Database.
 * Employs clean unsubscription to avoid client memory leaks.
 */
export function useLiveTournamentStatus(tournamentId?: string) {
  const [data, setData] = useState<LiveTournamentSyncData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!tournamentId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const tournamentRef = ref(rtdb, `liveTournaments/${tournamentId}`);

    const handleData = (snapshot: any) => {
      setData(snapshot.val());
      setLoading(false);
    };

    const handleError = (err: Error) => {
      setError(err);
      setLoading(false);
    };

    onValue(tournamentRef, handleData, handleError);

    return () => {
      off(tournamentRef, 'value', handleData);
    };
  }, [tournamentId]);

  return { data, loading, error };
}
