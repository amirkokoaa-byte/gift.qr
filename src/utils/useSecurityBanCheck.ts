import { useState, useEffect, useCallback } from 'react';
import {
  checkIsBanned,
  getUserIpAddress,
  initFirebase,
  LOCAL_BAN_STORAGE_KEY,
  type BanCheckResult,
} from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function useSecurityBanCheck() {
  const [isBanned, setIsBanned] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_BAN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.banned) {
          if (!parsed.banUntil || parsed.banUntil > Date.now()) {
            return true;
          }
        }
      }
    } catch {}
    return false;
  });

  const [bannedIp, setBannedIp] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_BAN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.ip || '';
      }
    } catch {}
    return '';
  });

  const [banReason, setBanReason] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_BAN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.reason || 'تم حظرك. لقد تجاوزت الحد المسموح به لمحاولات الدخول. تم حظر هذا الجهاز.';
      }
    } catch {}
    return 'تم حظرك. لقد تجاوزت الحد المسموح به لمحاولات الدخول. تم حظر هذا الجهاز.';
  });

  const [banUntil, setBanUntil] = useState<number | undefined>(undefined);
  const [bannedAt, setBannedAt] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const performBanCheck = useCallback(async () => {
    try {
      const ip = await getUserIpAddress();
      if (ip) {
        setBannedIp(ip);
      }

      const result: BanCheckResult = await checkIsBanned(ip);
      if (result.isBanned) {
        setIsBanned(true);
        if (result.reason) setBanReason(result.reason);
        if (result.ip) setBannedIp(result.ip);
        if (result.banUntil) setBanUntil(result.banUntil);
        if (result.bannedAt) setBannedAt(result.bannedAt);
      } else {
        // If Firestore and local storage say NOT banned:
        setIsBanned(false);
      }
    } catch (err) {
      console.warn('Error during security ban check:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    performBanCheck();

    // Listen for local trigger events
    const handleBanTriggered = (e: any) => {
      const detail = e.detail;
      setIsBanned(true);
      if (detail?.ip) setBannedIp(detail.ip);
      if (detail?.reason) setBanReason(detail.reason);
      if (detail?.banUntil) setBanUntil(detail.banUntil);
      if (detail?.bannedAt) setBannedAt(detail.bannedAt);
      setIsLoading(false);
    };

    const handleBanRemoved = () => {
      setIsBanned(false);
      setBanUntil(undefined);
      setBannedAt(undefined);
      setIsLoading(false);
    };

    window.addEventListener('softrose_ban_triggered', handleBanTriggered);
    window.addEventListener('softrose_ban_removed', handleBanRemoved);

    // Setup real-time Firestore listener for live unban if admin deletes from console
    let unsubscribeFirestore: (() => void) | null = null;
    (async () => {
      try {
        const ip = await getUserIpAddress();
        if (!ip || ip === 'unknown_ip') return;
        const { db, isFirebaseActive } = initFirebase();
        if (isFirebaseActive && db) {
          const sanitizedIp = ip.replace(/[.:/]/g, '_');
          const ipDocRef = doc(db, 'banned_ips', sanitizedIp);
          unsubscribeFirestore = onSnapshot(ipDocRef, (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              if (!data.banUntilMillis || data.banUntilMillis > Date.now()) {
                setIsBanned(true);
                setBannedIp(ip);
                setBanReason(data.reason || 'تم حظرك. لقد تجاوزت الحد المسموح به لمحاولات الدخول. تم حظر هذا الجهاز.');
                setBanUntil(data.banUntilMillis);
                setBannedAt(data.bannedAt);
              } else {
                // Expired
                setIsBanned(false);
                try {
                  localStorage.removeItem(LOCAL_BAN_STORAGE_KEY);
                } catch {}
              }
            } else {
              // Document does NOT exist in Firestore
              // If user was previously IP-banned, Admin removed it from console!
              try {
                const local = localStorage.getItem(LOCAL_BAN_STORAGE_KEY);
                if (local) {
                  const p = JSON.parse(local);
                  if (p.banned && p.ip === ip) {
                    // Admin lifted IP ban from Firebase Console!
                    localStorage.removeItem(LOCAL_BAN_STORAGE_KEY);
                    setIsBanned(false);
                  }
                }
              } catch {}
            }
          });
        }
      } catch (err) {
        console.warn('Real-time banned_ips subscription note:', err);
      }
    })();

    return () => {
      window.removeEventListener('softrose_ban_triggered', handleBanTriggered);
      window.removeEventListener('softrose_ban_removed', handleBanRemoved);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, [performBanCheck]);

  return {
    isBanned,
    bannedIp,
    banReason,
    banUntil,
    bannedAt,
    isLoading,
    recheckBan: performBanCheck,
  };
}
