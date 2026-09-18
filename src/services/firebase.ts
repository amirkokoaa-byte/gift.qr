import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  runTransaction,
  collection,
  onSnapshot,
  getDoc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, type FirebaseStorage } from 'firebase/storage';
import { CustomerRecord, CampaignSettings, SessionRecord, GenerationResult } from '../types';

// Production Firebase Configuration for Soft Rose International
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCwD7gdyijyY4-3OvVBl4DS_PYa6-4q3-k",
  authDomain: "qr-soft-1f4fe.firebaseapp.com",
  projectId: "qr-soft-1f4fe",
  storageBucket: "qr-soft-1f4fe.firebasestorage.app",
  messagingSenderId: "527054632033",
  appId: "1:527054632033:web:84c70f305b6f156c53e620",
};

// Default initial company settings for Soft Rose International
export const DEFAULT_SETTINGS: CampaignSettings = {
  companyName: 'سوفت روز انترناشيونال',
  companyNameEn: 'Soft Rose International',
  logoUrl: '', // Uses SVG brand mark if empty
  minNumber: 1000,
  maxNumber: 9999,
  adminPasscode: '0000',
  firebaseConfig: DEFAULT_FIREBASE_CONFIG,
};

// Storage keys for local persistence & fallback
const SETTINGS_STORAGE_KEY = 'softrose_campaign_settings';
const CUSTOMERS_STORAGE_KEY = 'softrose_customers_records';
const SESSIONS_STORAGE_KEY = 'softrose_qr_sessions';
const NUMBERS_STORAGE_KEY = 'softrose_allocated_numbers';

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedStorage: FirebaseStorage | null = null;

// Initialize Firebase dynamically if config is provided
export function initFirebase(customConfig?: CampaignSettings['firebaseConfig']): {
  db: Firestore | null;
  storage: FirebaseStorage | null;
  isFirebaseActive: boolean;
} {
  try {
    const config = customConfig || getStoredFirebaseConfig();
    if (!config || !config.apiKey || !config.projectId) {
      return { db: null, storage: null, isFirebaseActive: false };
    }

    if (!cachedApp && getApps().length === 0) {
      cachedApp = initializeApp(config);
    } else if (!cachedApp) {
      cachedApp = getApps()[0];
    }

    if (!cachedDb && cachedApp) {
      cachedDb = getFirestore(cachedApp);
    }
    if (!cachedStorage && cachedApp) {
      cachedStorage = getStorage(cachedApp);
    }

    return { db: cachedDb, storage: cachedStorage, isFirebaseActive: true };
  } catch (error) {
    console.warn('Firebase initialization note (using local fallback):', error);
    return { db: null, storage: null, isFirebaseActive: false };
  }
}

export function getStoredFirebaseConfig() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.firebaseConfig?.apiKey) return parsed.firebaseConfig;
    }
  } catch {
    // Ignore error
  }
  return DEFAULT_FIREBASE_CONFIG;
}

// -------------------------------------------------------------
// Settings Management
// -------------------------------------------------------------
export async function getCampaignSettings(): Promise<CampaignSettings> {
  const { db, isFirebaseActive } = initFirebase();

  if (isFirebaseActive && db) {
    try {
      const snap = await getDoc(doc(db, 'campaign', 'settings'));
      if (snap.exists()) {
        const data = snap.data() as CampaignSettings;
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    } catch (err) {
      console.warn('Error reading settings from Firestore, using local cache:', err);
    }
  }

  try {
    const local = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (local) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
    }
  } catch (err) {
    console.error('Error reading local settings:', err);
  }

  return DEFAULT_SETTINGS;
}

export async function saveCampaignSettings(settings: CampaignSettings): Promise<void> {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

  const { db, isFirebaseActive } = initFirebase(settings.firebaseConfig);
  if (isFirebaseActive && db) {
    try {
      await setDoc(doc(db, 'campaign', 'settings'), settings, { merge: true });
    } catch (err) {
      console.error('Error writing settings to Firestore:', err);
    }
  }
}

// -------------------------------------------------------------
// Session Status Check (QR Scan Validation)
// -------------------------------------------------------------
export async function getSessionRecord(sessionId: string): Promise<SessionRecord | null> {
  const { db, isFirebaseActive } = initFirebase();

  if (isFirebaseActive && db) {
    try {
      const snap = await getDoc(doc(db, 'sessions', sessionId));
      if (snap.exists()) {
        return snap.data() as SessionRecord;
      }
    } catch (err) {
      console.warn('Error checking session in Firestore:', err);
    }
  }

  // Local fallback
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    const sessions: Record<string, SessionRecord> = raw ? JSON.parse(raw) : {};
    return sessions[sessionId] || null;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Core Feature: Atomic Unique Number Generation & Lock Transaction
// -------------------------------------------------------------
export async function claimGiftWithUniqueNumber(
  sessionId: string,
  customerName: string,
  phoneNumber: string
): Promise<GenerationResult> {
  const settings = await getCampaignSettings();
  const min = Math.min(settings.minNumber, settings.maxNumber);
  const max = Math.max(settings.minNumber, settings.maxNumber);

  const { db, isFirebaseActive } = initFirebase();

  // Mode 1: Real Firebase Firestore Transaction
  if (isFirebaseActive && db) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        // 1. Check Session status atomically
        const sessionRef = doc(db, 'sessions', sessionId);
        const sessionSnap = await transaction.get(sessionRef);

        if (sessionSnap.exists() && sessionSnap.data()?.status === 'used') {
          return {
            success: false,
            isUsed: true,
            error: 'تم الحصول على الهدية مسبقاً، لا يمكن إعادة فتح المسح',
          };
        }

        // 2. Fetch allocated numbers registry to ensure strict uniqueness
        const registryRef = doc(db, 'campaign_metadata', 'allocated_numbers_registry');
        const registrySnap = await transaction.get(registryRef);
        
        let allocatedMap: Record<string, boolean> = {};
        if (registrySnap.exists()) {
          allocatedMap = registrySnap.data()?.allocated || {};
        }

        // Calculate available numbers in range [min, max]
        const rangeSize = max - min + 1;
        const allocatedKeys = Object.keys(allocatedMap);
        
        if (allocatedKeys.length >= rangeSize) {
          throw new Error('نعتذر، لقد نفدت جميع أرقام الهدايا المتاحة في هذا النطاق.');
        }

        // Generate candidate random number
        let candidate: number | null = null;
        let attempts = 0;
        const maxAttempts = 150;

        while (attempts < maxAttempts) {
          const rand = Math.floor(Math.random() * (max - min + 1)) + min;
          if (!allocatedMap[String(rand)]) {
            candidate = rand;
            break;
          }
          attempts++;
        }

        // If random probing is dense, scan sequentially for first available
        if (candidate === null) {
          for (let n = min; n <= max; n++) {
            if (!allocatedMap[String(n)]) {
              candidate = n;
              break;
            }
          }
        }

        if (candidate === null) {
          throw new Error('لا توجد أرقام متاحة حالياً.');
        }

        // 3. Mark number as allocated in registry
        allocatedMap[String(candidate)] = true;
        transaction.set(registryRef, { allocated: allocatedMap, lastUpdated: new Date().toISOString() }, { merge: true });

        // 4. Save dedicated individual lock document
        const numberLockRef = doc(db, 'allocated_numbers', String(candidate));
        transaction.set(numberLockRef, {
          giftNumber: candidate,
          sessionId,
          customerName,
          phoneNumber,
          timestamp: new Date().toISOString(),
        });

        // 5. Update Session state to "used"
        const sessionData: SessionRecord = {
          sessionId,
          status: 'used',
          claimedBy: {
            name: customerName,
            phone: phoneNumber,
            giftNumber: candidate,
            timestamp: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
        };
        transaction.set(sessionRef, sessionData, { merge: true });

        // 6. Record in customers list
        const customerRef = doc(collection(db, 'customers'));
        const now = new Date();
        const customerRecord: CustomerRecord = {
          id: customerRef.id,
          sessionId,
          customerName,
          phoneNumber,
          giftNumber: candidate,
          timestamp: now.toISOString(),
          formattedDate: now.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          claimedAtMillis: Date.now(),
        };
        transaction.set(customerRef, customerRecord);

        return {
          success: true,
          giftNumber: candidate,
        };
      });

      return result;
    } catch (err: any) {
      console.error('Firestore transaction error:', err);
      // If permission or network issue, fallback gracefully to client transaction
    }
  }

  // Mode 2: Client-side Atomic Simulation with LocalStorage Lock
  return performLocalAtomicTransaction(sessionId, customerName, phoneNumber, min, max);
}

// Client-side atomic transaction simulation
function performLocalAtomicTransaction(
  sessionId: string,
  customerName: string,
  phoneNumber: string,
  min: number,
  max: number
): GenerationResult {
  try {
    const rawSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
    const sessions: Record<string, SessionRecord> = rawSessions ? JSON.parse(rawSessions) : {};

    // Check if session is already used
    if (sessions[sessionId]?.status === 'used') {
      return {
        success: false,
        isUsed: true,
        error: 'تم الحصول على الهدية مسبقاً، لا يمكن إعادة فتح المسح',
      };
    }

    // Get allocated numbers list
    const rawNumbers = localStorage.getItem(NUMBERS_STORAGE_KEY);
    const allocated: Record<string, boolean> = rawNumbers ? JSON.parse(rawNumbers) : {};

    const rangeSize = max - min + 1;
    const allocatedCount = Object.keys(allocated).length;

    if (allocatedCount >= rangeSize) {
      return {
        success: false,
        error: 'نعتذر، لقد نفدت جميع أرقام الهدايا المتاحة في هذا النطاق.',
      };
    }

    // Pick random unique number
    let candidate: number | null = null;
    let attempts = 0;
    while (attempts < 200) {
      const rand = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!allocated[String(rand)]) {
        candidate = rand;
        break;
      }
      attempts++;
    }

    if (candidate === null) {
      for (let i = min; i <= max; i++) {
        if (!allocated[String(i)]) {
          candidate = i;
          break;
        }
      }
    }

    if (candidate === null) {
      return {
        success: false,
        error: 'لا توجد أرقام متاحة حالياً.',
      };
    }

    // Commit transaction locally
    allocated[String(candidate)] = true;
    localStorage.setItem(NUMBERS_STORAGE_KEY, JSON.stringify(allocated));

    const now = new Date();
    const sessionData: SessionRecord = {
      sessionId,
      status: 'used',
      claimedBy: {
        name: customerName,
        phone: phoneNumber,
        giftNumber: candidate,
        timestamp: now.toISOString(),
      },
      createdAt: now.toISOString(),
    };
    sessions[sessionId] = sessionData;
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));

    const rawCustomers = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    const customers: CustomerRecord[] = rawCustomers ? JSON.parse(rawCustomers) : [];

    const newRecord: CustomerRecord = {
      id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId,
      customerName,
      phoneNumber,
      giftNumber: candidate,
      timestamp: now.toISOString(),
      formattedDate: now.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      claimedAtMillis: Date.now(),
    };

    customers.unshift(newRecord);
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));

    // Also push to Firestore cloud database directly so all devices see the customer immediately
    const { db, isFirebaseActive } = initFirebase();
    if (isFirebaseActive && db) {
      const customerDocRef = doc(db, 'customers', newRecord.id);
      setDoc(customerDocRef, newRecord).catch((e) => console.warn('Firestore fallback customer write error:', e));
      const sessionDocRef = doc(db, 'sessions', sessionId);
      setDoc(sessionDocRef, sessionData, { merge: true }).catch((e) => console.warn('Firestore fallback session write error:', e));
    }

    // Dispatch custom event for real-time reactivity in the same tab/window
    window.dispatchEvent(new CustomEvent('softrose_data_updated'));

    return {
      success: true,
      giftNumber: candidate,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'حدث خطأ أثناء حجز رقم الهدية.',
    };
  }
}

// -------------------------------------------------------------
// Real-time Customers Listener (Cloud Firestore + Local Merge)
// -------------------------------------------------------------
export function subscribeToCustomers(callback: (customers: CustomerRecord[]) => void): () => void {
  const { db, isFirebaseActive } = initFirebase();

  // Trigger background sync of any previously unsynced local records
  syncLocalCustomersToFirestore().catch((err) => console.warn('Initial sync error:', err));

  if (isFirebaseActive && db) {
    try {
      const q = collection(db, 'customers');
      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          const list: CustomerRecord[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));

          // Merge any local records that might not be in Firestore yet
          try {
            const rawLocal = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
            if (rawLocal) {
              const localList: CustomerRecord[] = JSON.parse(rawLocal);
              for (const loc of localList) {
                if (!list.some((c) => c.id === loc.id || c.sessionId === loc.sessionId)) {
                  list.push(loc);
                }
              }
            }
          } catch {}

          // Sort newest first
          list.sort((a, b) => (b.claimedAtMillis || 0) - (a.claimedAtMillis || 0));
          callback(list);
        },
        (error) => {
          console.warn('Firestore snapshot error, falling back to local:', error);
          loadLocalCustomers(callback);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.warn('Cannot establish Firestore snapshot, using local listener:', e);
    }
  }

  // Local storage listener
  loadLocalCustomers(callback);
  const handleUpdate = () => loadLocalCustomers(callback);
  window.addEventListener('softrose_data_updated', handleUpdate);
  window.addEventListener('storage', handleUpdate);

  return () => {
    window.removeEventListener('softrose_data_updated', handleUpdate);
    window.removeEventListener('storage', handleUpdate);
  };
}

// Upload any records stored in localStorage into Firestore cloud
export async function syncLocalCustomersToFirestore(): Promise<void> {
  const { db, isFirebaseActive } = initFirebase();
  if (!isFirebaseActive || !db) return;

  try {
    const raw = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (!raw) return;
    const localCustomers: CustomerRecord[] = JSON.parse(raw);
    for (const cust of localCustomers) {
      if (cust.sessionId) {
        const cRef = cust.id ? doc(db, 'customers', cust.id) : doc(collection(db, 'customers'));
        await setDoc(cRef, cust, { merge: true });
      }
    }
  } catch (err) {
    console.warn('Sync local customers to firestore warning:', err);
  }
}

function loadLocalCustomers(callback: (customers: CustomerRecord[]) => void) {
  try {
    const raw = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    const list: CustomerRecord[] = raw ? JSON.parse(raw) : [];
    callback(list);
  } catch {
    callback([]);
  }
}

// -------------------------------------------------------------
// Logo Upload Helper (Firebase Storage or Base64 Data URL)
// -------------------------------------------------------------
export async function uploadLogo(file: File): Promise<string> {
  const { storage, isFirebaseActive } = initFirebase();

  if (isFirebaseActive && storage) {
    try {
      const filename = `logos/company_logo_${Date.now()}.${file.name.split('.').pop() || 'png'}`;
      const storageRef = ref(storage, filename);
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const dataUrl = await base64Promise;
      await uploadString(storageRef, dataUrl, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (err) {
      console.warn('Firebase Storage upload failed, saving as inline base64:', err);
    }
  }

  // Fallback to Base64 image
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// -------------------------------------------------------------
// Demo / Testing Helpers for Admin
// -------------------------------------------------------------
export function createNewSessionId(): string {
  return 'sr_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

export function resetAllCampaignData(): void {
  localStorage.removeItem(CUSTOMERS_STORAGE_KEY);
  localStorage.removeItem(SESSIONS_STORAGE_KEY);
  localStorage.removeItem(NUMBERS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('softrose_data_updated'));
}
