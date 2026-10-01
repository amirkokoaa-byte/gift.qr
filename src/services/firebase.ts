import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  runTransaction,
  collection,
  onSnapshot,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, type FirebaseStorage } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { CustomerRecord, CampaignSettings, SessionRecord, GenerationResult, RaffleWinnerRecord } from '../types';

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
const RAFFLE_WINNERS_STORAGE_KEY = 'softrose_raffle_winners';

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedStorage: FirebaseStorage | null = null;

// Firebase Cloud Health Status Tracking
export type FirebaseHealthStatus = 'checking' | 'connected' | 'permission_denied' | 'error' | 'local_only';
let currentHealthStatus: FirebaseHealthStatus = 'checking';
let lastHealthErrorDetails: string = '';
let healthListeners: ((status: FirebaseHealthStatus, details: string) => void)[] = [];

export function subscribeToFirebaseHealth(cb: (status: FirebaseHealthStatus, details: string) => void): () => void {
  healthListeners.push(cb);
  cb(currentHealthStatus, lastHealthErrorDetails);
  return () => {
    healthListeners = healthListeners.filter((l) => l !== cb);
  };
}

function updateHealthStatus(status: FirebaseHealthStatus, details: string = '') {
  currentHealthStatus = status;
  lastHealthErrorDetails = details;
  healthListeners.forEach((l) => l(status, details));
}

// Initialize Firebase dynamically if config is provided
export function initFirebase(customConfig?: CampaignSettings['firebaseConfig']): {
  db: Firestore | null;
  storage: FirebaseStorage | null;
  isFirebaseActive: boolean;
} {
  try {
    const config = customConfig || getStoredFirebaseConfig();
    if (!config || !config.apiKey || !config.projectId) {
      updateHealthStatus('local_only', 'لم يتم ضبط إعدادات Firebase');
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

    // Try signing in anonymously if enabled in project
    if (cachedApp) {
      try {
        const auth = getAuth(cachedApp);
        if (!auth.currentUser) {
          signInAnonymously(auth).catch(() => {
            // Anonymous auth might not be enabled yet in console, which is fine if rules are open
          });
        }
      } catch (authErr) {
        // Ignore auth error
      }
    }

    return { db: cachedDb, storage: cachedStorage, isFirebaseActive: true };
  } catch (error: any) {
    console.warn('Firebase initialization note (using local fallback):', error);
    updateHealthStatus('error', error?.message || 'خطأ في تهيئة Firebase');
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
// Mark Session as Scanned (Called when Customer opens QR link)
// -------------------------------------------------------------
export async function markSessionAsScanned(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const now = new Date().toISOString();

  // 1. Update local storage record
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    const sessions: Record<string, SessionRecord> = raw ? JSON.parse(raw) : {};
    if (!sessions[sessionId] || sessions[sessionId].status !== 'used') {
      sessions[sessionId] = {
        sessionId,
        status: 'scanned',
        scannedAt: now,
        scannedAtMillis: Date.now(),
        createdAt: sessions[sessionId]?.createdAt || now,
        claimedBy: sessions[sessionId]?.claimedBy,
      };
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    }
  } catch (e) {
    console.warn('Local session scan update error:', e);
  }

  // 2. Dispatch local event for same-browser tabs/views
  window.dispatchEvent(new CustomEvent('softrose_data_updated'));

  // 3. Update Firestore cloud database for real-time cross-device synchronization
  const { db, isFirebaseActive } = initFirebase();
  if (isFirebaseActive && db) {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      await setDoc(
        sessionRef,
        {
          sessionId,
          status: 'scanned',
          scannedAt: now,
          scannedAtMillis: Date.now(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore markSessionAsScanned error:', err);
    }
  }
}

// -------------------------------------------------------------
// Subscribe to Session in Real-time (Triggers new QR on scan/claim)
// -------------------------------------------------------------
export function subscribeToSession(
  sessionId: string,
  callback: (session: SessionRecord | null) => void
): () => void {
  if (!sessionId) {
    return () => {};
  }

  const { db, isFirebaseActive } = initFirebase();
  let isCleanedUp = false;
  let unsubFirestore: (() => void) | null = null;

  // 1. Listen via Firestore real-time onSnapshot if active
  if (isFirebaseActive && db) {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      unsubFirestore = onSnapshot(
        sessionRef,
        (snap) => {
          if (isCleanedUp) return;
          if (snap.exists()) {
            callback(snap.data() as SessionRecord);
          } else {
            const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
            const sessions: Record<string, SessionRecord> = raw ? JSON.parse(raw) : {};
            callback(sessions[sessionId] || null);
          }
        },
        (err) => {
          console.warn('Firestore session snapshot error:', err);
          const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
          const sessions: Record<string, SessionRecord> = raw ? JSON.parse(raw) : {};
          callback(sessions[sessionId] || null);
        }
      );
    } catch (err) {
      console.warn('subscribeToSession firestore error:', err);
    }
  }

  // 2. Listen to local storage & window events for local / same-tab testing
  const handleLocalChange = () => {
    if (isCleanedUp) return;
    try {
      const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (raw) {
        const sessions: Record<string, SessionRecord> = JSON.parse(raw);
        if (sessions[sessionId]) {
          callback(sessions[sessionId]);
        }
      }
    } catch {}
  };

  window.addEventListener('storage', handleLocalChange);
  window.addEventListener('softrose_data_updated', handleLocalChange);

  // Immediate initial check
  getSessionRecord(sessionId).then((rec) => {
    if (!isCleanedUp && rec) {
      callback(rec);
    }
  });

  return () => {
    isCleanedUp = true;
    if (unsubFirestore) {
      unsubFirestore();
    }
    window.removeEventListener('storage', handleLocalChange);
    window.removeEventListener('softrose_data_updated', handleLocalChange);
  };
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

  let unsubFirestore: (() => void) | null = null;
  let isCleanedUp = false;
  let latestFirestoreList: CustomerRecord[] = [];

  const emitData = (firestoreData: CustomerRecord[] = latestFirestoreList) => {
    if (isCleanedUp) return;
    const list: CustomerRecord[] = [...firestoreData];

    // Merge any local records that might not be in Firestore yet
    try {
      const rawLocal = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
      if (rawLocal) {
        const localList: CustomerRecord[] = JSON.parse(rawLocal);
        for (const loc of localList) {
          if (!list.some((c) => c.id === loc.id || (loc.sessionId && c.sessionId === loc.sessionId))) {
            list.push(loc);
          }
        }
      }
    } catch {}

    // Sort newest first
    list.sort((a, b) => (b.claimedAtMillis || 0) - (a.claimedAtMillis || 0));
    callback(list);
  };

  if (isFirebaseActive && db) {
    try {
      const q = collection(db, 'customers');
      unsubFirestore = onSnapshot(
        q,
        (snap) => {
          if (isCleanedUp) return;
          updateHealthStatus('connected', 'متصل بالسحابة (Firebase Connected)');
          latestFirestoreList = [];
          snap.forEach((d) => latestFirestoreList.push({ id: d.id, ...(d.data() as any) }));
          emitData(latestFirestoreList);
        },
        (error: any) => {
          if (isCleanedUp) return;
          console.warn('Firestore snapshot error, falling back to local:', error);
          if (error?.code === 'permission-denied') {
            updateHealthStatus('permission_denied', 'قواعد Firestore في Firebase Console مقفلة وترفض القراءة والكتابة (permission-denied)');
          } else {
            updateHealthStatus('error', error?.message || 'خطأ في الاتصال بقاعدة بيانات Firebase');
          }
          loadLocalCustomers(callback);
        }
      );
    } catch (e: any) {
      console.warn('Cannot establish Firestore snapshot, using local listener:', e);
      updateHealthStatus('error', e?.message || 'تعذر بدء مراقبة قاعدة البيانات');
      loadLocalCustomers(callback);
    }
  } else {
    updateHealthStatus('local_only', 'يعمل في الوضع المحلي');
    loadLocalCustomers(callback);
  }

  // Real-time listener for manual resets and cross-tab/local updates
  const handleUpdate = () => {
    if (isCleanedUp) return;
    const rawLocal = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (!rawLocal || rawLocal === '[]') {
      if (!isFirebaseActive || !db) {
        callback([]);
      } else {
        // Re-emit immediately to reflect cleared local storage
        emitData([]);
      }
    } else {
      emitData();
    }
  };

  window.addEventListener('softrose_data_updated', handleUpdate);
  window.addEventListener('storage', handleUpdate);

  return () => {
    isCleanedUp = true;
    if (unsubFirestore) unsubFirestore();
    window.removeEventListener('softrose_data_updated', handleUpdate);
    window.removeEventListener('storage', handleUpdate);
  };
}

// Upload any records stored in localStorage into Firestore cloud
export async function syncLocalCustomersToFirestore(): Promise<number> {
  const { db, isFirebaseActive } = initFirebase();
  if (!isFirebaseActive || !db) return 0;

  let count = 0;
  try {
    const raw = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (!raw) return 0;
    const localCustomers: CustomerRecord[] = JSON.parse(raw);
    for (const cust of localCustomers) {
      if (cust.sessionId || cust.customerName) {
        const cRef = cust.id ? doc(db, 'customers', cust.id) : doc(collection(db, 'customers'));
        await setDoc(cRef, cust, { merge: true });
        count++;
      }
    }
    if (count > 0) {
      updateHealthStatus('connected', 'تم مزامنة السجلات بنجاح مع السحابة');
    }
  } catch (err: any) {
    console.warn('Sync local customers to firestore warning:', err);
    if (err?.code === 'permission-denied') {
      updateHealthStatus('permission_denied', 'قواعد Firestore في Firebase Console مقفلة (permission-denied)');
    }
  }
  return count;
}

// Manual Test & Cloud Sync Trigger for the Admin
export async function testAndSyncCloudData(): Promise<{
  success: boolean;
  status: FirebaseHealthStatus;
  message: string;
  count: number;
}> {
  const { db, isFirebaseActive } = initFirebase();
  if (!isFirebaseActive || !db) {
    updateHealthStatus('local_only', 'لم يتم ضبط إعدادات Firebase');
    return {
      success: false,
      status: 'local_only',
      message: 'لم يتم العثور على إعدادات مشروع Firebase.',
      count: 0,
    };
  }

  try {
    // Test write & read to verify rules
    const testRef = doc(db, 'campaign_metadata', 'connection_probe');
    await setDoc(testRef, { lastPing: new Date().toISOString() }, { merge: true });
    
    // If successful, push local records to cloud
    const syncedCount = await syncLocalCustomersToFirestore();
    updateHealthStatus('connected', 'قاعدة البيانات السحابية متصلة ومفتوحة بنجاح!');
    
    window.dispatchEvent(new CustomEvent('softrose_data_updated'));
    return {
      success: true,
      status: 'connected',
      message: `تم الاتصال بالسحابة بنجاح! تم رفع ومزامنة ${syncedCount} من السجلات. ستظهر البيانات الآن فوراً على الكمبيوتر وكافة الأجهزة.`,
      count: syncedCount,
    };
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      updateHealthStatus('permission_denied', 'قواعد Firestore ترفض الوصول (permission-denied)');
      return {
        success: false,
        status: 'permission_denied',
        message: 'لا تزال قواعد الأمان في Firebase Console مقفلة (permission-denied). يرجى فتح تبويب Rules وتعيين allow read, write: if true; ثم الضغط على Publish.',
        count: 0,
      };
    }
    updateHealthStatus('error', err?.message || 'فشل الاتصال بـ Firebase');
    return {
      success: false,
      status: 'error',
      message: `فشل الاتصال: ${err?.message || 'خطأ غير معروف'}`,
      count: 0,
    };
  }
}

// -------------------------------------------------------------
// Update Existing Customer Record (Edit in Modal)
// -------------------------------------------------------------
export async function updateCustomerRecord(
  customerId: string,
  updates: {
    customerName: string;
    phoneNumber: string;
    giftNumber: number;
  },
  oldGiftNumber?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Update in Local Storage
    const rawCustomers = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    let customers: CustomerRecord[] = rawCustomers ? JSON.parse(rawCustomers) : [];
    let targetSessionId = '';

    customers = customers.map((c) => {
      if (c.id === customerId) {
        targetSessionId = c.sessionId;
        return {
          ...c,
          customerName: updates.customerName.trim(),
          phoneNumber: updates.phoneNumber.trim(),
          giftNumber: updates.giftNumber,
        };
      }
      return c;
    });
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));

    // 2. Adjust allocated numbers if gift number changed
    if (oldGiftNumber !== undefined && oldGiftNumber !== updates.giftNumber) {
      const rawNumbers = localStorage.getItem(NUMBERS_STORAGE_KEY);
      const allocated: Record<string, boolean> = rawNumbers ? JSON.parse(rawNumbers) : {};
      delete allocated[String(oldGiftNumber)];
      allocated[String(updates.giftNumber)] = true;
      localStorage.setItem(NUMBERS_STORAGE_KEY, JSON.stringify(allocated));
    }

    // 3. Update Session record in Local Storage
    if (targetSessionId) {
      const rawSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (rawSessions) {
        const sessions: Record<string, SessionRecord> = JSON.parse(rawSessions);
        if (sessions[targetSessionId]) {
          sessions[targetSessionId] = {
            ...sessions[targetSessionId],
            claimedBy: {
              name: updates.customerName.trim(),
              phone: updates.phoneNumber.trim(),
              giftNumber: updates.giftNumber,
              timestamp: sessions[targetSessionId].claimedBy?.timestamp || new Date().toISOString(),
            },
          };
          localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
        }
      }
    }

    // 4. Update in Cloud Firestore if available
    const { db, isFirebaseActive } = initFirebase();
    if (isFirebaseActive && db) {
      try {
        const customerRef = doc(db, 'customers', customerId);
        await setDoc(
          customerRef,
          {
            customerName: updates.customerName.trim(),
            phoneNumber: updates.phoneNumber.trim(),
            giftNumber: updates.giftNumber,
          },
          { merge: true }
        );

        if (targetSessionId) {
          const sessionRef = doc(db, 'sessions', targetSessionId);
          await setDoc(
            sessionRef,
            {
              claimedBy: {
                name: updates.customerName.trim(),
                phone: updates.phoneNumber.trim(),
                giftNumber: updates.giftNumber,
              },
            },
            { merge: true }
          );
        }

        if (oldGiftNumber !== undefined && oldGiftNumber !== updates.giftNumber) {
          const registryRef = doc(db, 'campaign_metadata', 'allocated_numbers_registry');
          const snap = await getDoc(registryRef);
          let map: Record<string, boolean> = {};
          if (snap.exists()) {
            map = snap.data()?.allocated || {};
          }
          delete map[String(oldGiftNumber)];
          map[String(updates.giftNumber)] = true;
          await setDoc(registryRef, { allocated: map, lastUpdated: new Date().toISOString() }, { merge: true });
        }
      } catch (cloudErr) {
        console.warn('Firestore update warning:', cloudErr);
      }
    }

    window.dispatchEvent(new CustomEvent('softrose_data_updated'));
    return { success: true };
  } catch (err: any) {
    console.error('Error updating customer record:', err);
    return { success: false, error: err?.message || 'فشل تحديث بيانات العميل.' };
  }
}

// -------------------------------------------------------------
// Delete Customer Record Helper
// -------------------------------------------------------------
export async function deleteCustomerRecord(
  customerId: string,
  giftNumber?: number,
  sessionId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Remove from Local Storage
    const rawCustomers = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (rawCustomers) {
      const customers: CustomerRecord[] = JSON.parse(rawCustomers);
      const filtered = customers.filter((c) => c.id !== customerId);
      localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(filtered));
    }

    // 2. Free allocated number
    if (giftNumber !== undefined) {
      const rawNumbers = localStorage.getItem(NUMBERS_STORAGE_KEY);
      if (rawNumbers) {
        const allocated: Record<string, boolean> = JSON.parse(rawNumbers);
        delete allocated[String(giftNumber)];
        localStorage.setItem(NUMBERS_STORAGE_KEY, JSON.stringify(allocated));
      }
    }

    // 3. Reset session
    if (sessionId) {
      const rawSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (rawSessions) {
        const sessions: Record<string, SessionRecord> = JSON.parse(rawSessions);
        if (sessions[sessionId]) {
          sessions[sessionId].status = 'active';
          delete sessions[sessionId].claimedBy;
          localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
        }
      }
    }

    // 4. Update in Cloud Firestore
    const { db, isFirebaseActive } = initFirebase();
    if (isFirebaseActive && db) {
      try {
        await deleteDoc(doc(db, 'customers', customerId));
        if (giftNumber !== undefined) {
          const registryRef = doc(db, 'campaign_metadata', 'allocated_numbers_registry');
          const snap = await getDoc(registryRef);
          if (snap.exists()) {
            const map = snap.data()?.allocated || {};
            delete map[String(giftNumber)];
            await setDoc(registryRef, { allocated: map, lastUpdated: new Date().toISOString() }, { merge: true });
          }
        }
      } catch (e) {
        console.warn('Firestore delete error:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('softrose_data_updated'));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل حذف السجل.' };
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
// Demo / Testing Helpers & Session Security Verification
// -------------------------------------------------------------
const SESSION_SECRET_SALT = 'sr_intl_softrose_security_token_2025';

export function calculateSessionSignature(baseStr: string): string {
  let hash = 0x811c9dc5;
  const combined = baseStr + ':' + SESSION_SECRET_SALT;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export function createNewSessionId(): string {
  const rand = Math.random().toString(36).substring(2, 8);
  const time = Date.now().toString(36);
  const base = `sr_${rand}_${time}`;
  const sig = calculateSessionSignature(base);
  const fullId = `${base}_${sig}`;

  // Automatically register this generated session in local and cloud stores
  registerGeneratedSession(fullId).catch(() => {});
  return fullId;
}

export async function registerGeneratedSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const now = new Date().toISOString();

  // 1. Local storage registration
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    const sessions: Record<string, SessionRecord> = raw ? JSON.parse(raw) : {};
    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        sessionId,
        status: 'active',
        createdAt: now,
        createdAtMillis: Date.now(),
        isGenerated: true,
      };
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    }
  } catch (e) {
    console.warn('Local session register error:', e);
  }

  // 2. Firestore Cloud registration
  const { db, isFirebaseActive } = initFirebase();
  if (isFirebaseActive && db) {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      const snap = await getDoc(sessionRef);
      if (!snap.exists()) {
        await setDoc(sessionRef, {
          sessionId,
          status: 'active',
          createdAt: now,
          createdAtMillis: Date.now(),
          isGenerated: true,
        });
      }
    } catch (err) {
      console.warn('Firestore register session error:', err);
    }
  }
}

export interface SessionVerificationResult {
  isValid: boolean;
  isOfficial: boolean;
  status?: 'active' | 'scanned' | 'used';
  sessionRecord?: SessionRecord | null;
  reason?: string;
}

export async function verifySessionAuthenticity(sessionId: string | null | undefined): Promise<SessionVerificationResult> {
  if (!sessionId || typeof sessionId !== 'string') {
    return {
      isValid: false,
      isOfficial: false,
      reason: 'رابط الجلسة غير موجود أو فارغ في المتصفح.',
    };
  }

  // 1. Basic format check: Must start with sr_ and contain only valid alphanumeric and underscore characters
  if (!/^sr_[a-z0-9_]{6,65}$/i.test(sessionId)) {
    return {
      isValid: false,
      isOfficial: false,
      reason: 'تم رصد تلاعب في صيغة رمز الجلسة في شريط المتصفح.',
    };
  }

  // 2. Cryptographic signature check if signed format (4 segments: sr_rand_time_sig)
  const parts = sessionId.split('_');
  if (parts.length >= 4) {
    const base = parts.slice(0, 3).join('_');
    const providedSig = parts.slice(3).join('_');
    const expectedSig = calculateSessionSignature(base);
    if (providedSig !== expectedSig) {
      return {
        isValid: false,
        isOfficial: false,
        reason: 'تم رصد تلاعب أو تعديل يدوي في أرقام وحروف رابط الجلسة.',
      };
    }
  }

  // 3. Official generation & database existence check
  const sessionRecord = await getSessionRecord(sessionId);
  if (!sessionRecord) {
    // If not in database or local storage, this session was never officially generated by the booth
    return {
      isValid: false,
      isOfficial: false,
      reason: 'هذا الرابط لم يتم توليده بواسطة شاشة العرض الرسمية.',
    };
  }

  return {
    isValid: true,
    isOfficial: true,
    status: sessionRecord.status,
    sessionRecord,
  };
}

export async function resetAllCampaignData(): Promise<void> {
  // 1. Clear local storage immediately
  try {
    localStorage.removeItem(CUSTOMERS_STORAGE_KEY);
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify([]));
    localStorage.removeItem(SESSIONS_STORAGE_KEY);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify({}));
    localStorage.removeItem(NUMBERS_STORAGE_KEY);
    localStorage.setItem(NUMBERS_STORAGE_KEY, JSON.stringify({}));
    localStorage.removeItem(RAFFLE_WINNERS_STORAGE_KEY);
    localStorage.setItem(RAFFLE_WINNERS_STORAGE_KEY, JSON.stringify([]));
    localStorage.removeItem('softrose_device_claimed');
  } catch (e) {
    console.warn('Error clearing localStorage on reset:', e);
  }

  // Dispatch events to update UI immediately
  window.dispatchEvent(new CustomEvent('softrose_data_updated'));
  window.dispatchEvent(new CustomEvent('softrose_raffle_updated'));

  // 2. Clear real Firestore database
  const { db, isFirebaseActive } = initFirebase();
  if (isFirebaseActive && db) {
    try {
      const collectionsToClear = ['customers', 'sessions', 'allocated_numbers', 'raffle_winners'];

      for (const colName of collectionsToClear) {
        try {
          const colRef = collection(db, colName);
          const snap = await getDocs(colRef);
          if (!snap.empty) {
            const docs = snap.docs;
            // 2a. Attempt batch delete first
            try {
              for (let i = 0; i < docs.length; i += 400) {
                const chunk = docs.slice(i, i + 400);
                const batch = writeBatch(db);
                chunk.forEach((d) => batch.delete(d.ref));
                await batch.commit();
              }
            } catch (batchErr) {
              console.warn(`writeBatch failed for ${colName}, attempting individual deletes:`, batchErr);
              // 2b. Fallback: individual deleteDoc for each document
              await Promise.allSettled(docs.map((d) => deleteDoc(d.ref)));
            }
          }
        } catch (colErr) {
          console.warn(`Error clearing Firestore collection ${colName}:`, colErr);
        }
      }

      // Reset campaign_metadata allocated_numbers_registry document
      try {
        const regRef = doc(db, 'campaign_metadata', 'allocated_numbers_registry');
        await setDoc(regRef, { numbers: [], allocated: {}, lastReset: new Date().toISOString() });
      } catch (regErr) {
        console.warn('Error resetting metadata registry in Firestore:', regErr);
      }
    } catch (err) {
      console.error('Firestore reset error:', err);
    }
  }

  // 3. Re-verify localStorage cleanup
  try {
    localStorage.removeItem(CUSTOMERS_STORAGE_KEY);
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify([]));
    localStorage.removeItem(SESSIONS_STORAGE_KEY);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify({}));
    localStorage.removeItem(NUMBERS_STORAGE_KEY);
    localStorage.setItem(NUMBERS_STORAGE_KEY, JSON.stringify({}));
    localStorage.removeItem(RAFFLE_WINNERS_STORAGE_KEY);
    localStorage.setItem(RAFFLE_WINNERS_STORAGE_KEY, JSON.stringify([]));
    localStorage.removeItem('softrose_device_claimed');
  } catch (e) {
    console.warn('Error re-clearing localStorage on reset:', e);
  }

  // Dispatch events again after cloud deletion completes
  window.dispatchEvent(new CustomEvent('softrose_data_updated'));
  window.dispatchEvent(new CustomEvent('softrose_raffle_updated'));
}

// -------------------------------------------------------------
// Random Draw / Raffle Winners Management
// -------------------------------------------------------------
export function subscribeToRaffleWinners(callback: (winners: RaffleWinnerRecord[]) => void): () => void {
  const { db, isFirebaseActive } = initFirebase();
  let unsubFirestore: (() => void) | null = null;
  let isCleanedUp = false;

  const emitLocal = () => {
    try {
      const raw = localStorage.getItem(RAFFLE_WINNERS_STORAGE_KEY);
      const list: RaffleWinnerRecord[] = raw ? JSON.parse(raw) : [];
      list.sort((a, b) => b.wonAtMillis - a.wonAtMillis);
      callback(list);
    } catch {
      callback([]);
    }
  };

  if (isFirebaseActive && db) {
    try {
      const q = collection(db, 'raffle_winners');
      unsubFirestore = onSnapshot(
        q,
        (snap) => {
          if (isCleanedUp) return;
          const list: RaffleWinnerRecord[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));

          // Merge local in case some were saved offline
          try {
            const raw = localStorage.getItem(RAFFLE_WINNERS_STORAGE_KEY);
            if (raw) {
              const localList: RaffleWinnerRecord[] = JSON.parse(raw);
              for (const loc of localList) {
                if (!list.some((w) => w.id === loc.id || (w.customer?.id && w.customer.id === loc.customer?.id))) {
                  list.push(loc);
                }
              }
            }
          } catch {}

          list.sort((a, b) => b.wonAtMillis - a.wonAtMillis);
          callback(list);
        },
        (err) => {
          console.warn('Firestore raffle winners snapshot error:', err);
          emitLocal();
        }
      );
    } catch (err) {
      console.warn('subscribeToRaffleWinners firestore error:', err);
      emitLocal();
    }
  } else {
    emitLocal();
  }

  const handleUpdate = () => {
    if (isCleanedUp) return;
    emitLocal();
  };

  window.addEventListener('storage', handleUpdate);
  window.addEventListener('softrose_data_updated', handleUpdate);

  return () => {
    isCleanedUp = true;
    if (unsubFirestore) unsubFirestore();
    window.removeEventListener('storage', handleUpdate);
    window.removeEventListener('softrose_data_updated', handleUpdate);
  };
}

export async function addRaffleWinner(customer: CustomerRecord): Promise<RaffleWinnerRecord> {
  const winnerRecord: RaffleWinnerRecord = {
    id: 'winner_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    customer,
    wonAt: new Date().toISOString(),
    wonAtMillis: Date.now(),
  };

  // 1. Save locally
  try {
    const raw = localStorage.getItem(RAFFLE_WINNERS_STORAGE_KEY);
    const list: RaffleWinnerRecord[] = raw ? JSON.parse(raw) : [];
    // Insert at front
    list.unshift(winnerRecord);
    localStorage.setItem(RAFFLE_WINNERS_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Error saving local raffle winner:', e);
  }

  window.dispatchEvent(new CustomEvent('softrose_data_updated'));

  // 2. Save in Firestore if active
  const { db, isFirebaseActive } = initFirebase();
  if (isFirebaseActive && db) {
    try {
      await setDoc(doc(db, 'raffle_winners', winnerRecord.id), winnerRecord);
    } catch (err) {
      console.warn('Firestore addRaffleWinner error:', err);
    }
  }

  return winnerRecord;
}

export async function deleteRaffleWinner(winnerId: string): Promise<void> {
  // 1. Local
  try {
    const raw = localStorage.getItem(RAFFLE_WINNERS_STORAGE_KEY);
    if (raw) {
      const list: RaffleWinnerRecord[] = JSON.parse(raw);
      const filtered = list.filter((w) => w.id !== winnerId);
      localStorage.setItem(RAFFLE_WINNERS_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn('Error deleting local winner:', e);
  }

  window.dispatchEvent(new CustomEvent('softrose_data_updated'));

  // 2. Firestore
  const { db, isFirebaseActive } = initFirebase();
  if (isFirebaseActive && db) {
    try {
      await deleteDoc(doc(db, 'raffle_winners', winnerId));
    } catch (err) {
      console.warn('Firestore deleteRaffleWinner error:', err);
    }
  }
}

export async function clearAllRaffleWinners(): Promise<void> {
  localStorage.removeItem(RAFFLE_WINNERS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('softrose_data_updated'));

  const { db, isFirebaseActive } = initFirebase();
  if (isFirebaseActive && db) {
    try {
      // In Firestore, get winners and delete each
      const snap = await onSnapshot(collection(db, 'raffle_winners'), (snapshot) => {
        snapshot.forEach((d) => {
          deleteDoc(doc(db, 'raffle_winners', d.id)).catch(() => {});
        });
      });
      setTimeout(() => snap(), 2000);
    } catch (e) {
      console.warn('Error clearing firestore winners:', e);
    }
  }
}

// =============================================================
// MILITARY-GRADE ANTI-TAMPERING & BAN SYSTEM (2026)
// =============================================================

export const LOCAL_BAN_STORAGE_KEY = 'softrose_banned_device';
export const STRIKE_COUNT_STORAGE_KEY = 'softrose_strike_count';
export const BAN_DURATION_MS = 31536000000000; // 1000 years (~31.5 trillion ms)
export const QR_SCAN_SECRET = 'softrose_military_qr_salt_2026';

let cachedUserIp: string | null = null;

export async function getUserIpAddress(): Promise<string> {
  if (cachedUserIp && cachedUserIp !== 'unknown_ip') return cachedUserIp;
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        cachedUserIp = String(data.ip).trim();
        return cachedUserIp;
      }
    }
  } catch {
    // Fallback 1
    try {
      const res2 = await fetch('https://api64.ipify.org?format=json', { signal: AbortSignal.timeout(3500) });
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.ip) {
          cachedUserIp = String(data2.ip).trim();
          return cachedUserIp;
        }
      }
    } catch {
      // Fallback 2
      try {
        const res3 = await fetch('https://ipapi.co/json', { signal: AbortSignal.timeout(3500) });
        if (res3.ok) {
          const data3 = await res3.json();
          if (data3 && data3.ip) {
            cachedUserIp = String(data3.ip).trim();
            return cachedUserIp;
          }
        }
      } catch {}
    }
  }
  return cachedUserIp || '127.0.0.1';
}

export function generateQrScanToken(sessionId: string, timestamp: number): string {
  const payload = `${sessionId}:${timestamp}:${QR_SCAN_SECRET}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export function verifyQrScanToken(
  sessionId: string | null | undefined,
  token: string | null | undefined,
  timestampStr: string | null | undefined,
  srcParam: string | null | undefined
): boolean {
  if (!sessionId || !token || !timestampStr) return false;
  // Origin check: must have legitimate QR source indicator
  if (srcParam !== 'qr') return false;

  const ts = parseInt(timestampStr, 10);
  if (isNaN(ts)) return false;

  const expected = generateQrScanToken(sessionId, ts);
  if (token !== expected) return false;

  // Maximum validity: 24 hours
  const age = Math.abs(Date.now() - ts);
  if (age > 24 * 60 * 60 * 1000) return false;

  return true;
}

export function getStoredStrikeCount(): number {
  try {
    const raw = localStorage.getItem(STRIKE_COUNT_STORAGE_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setStoredStrikeCount(count: number): void {
  try {
    localStorage.setItem(STRIKE_COUNT_STORAGE_KEY, String(count));
  } catch {}
}

export function resetStrikeCount(): void {
  try {
    localStorage.removeItem(STRIKE_COUNT_STORAGE_KEY);
  } catch {}
}

export interface BanCheckResult {
  isBanned: boolean;
  reason?: string;
  ip?: string;
  bannedAt?: string;
  banUntil?: number;
}

export async function checkIsBanned(targetIp?: string): Promise<BanCheckResult> {
  // 1. Check LocalStorage Ban
  try {
    const rawLocal = localStorage.getItem(LOCAL_BAN_STORAGE_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed && parsed.banned) {
        if (!parsed.banUntil || parsed.banUntil > Date.now()) {
          return {
            isBanned: true,
            reason: parsed.reason || 'تم حظرك. لقد تجاوزت الحد المسموح به لمحاولات الدخول. تم حظر هذا الجهاز.',
            ip: parsed.ip || targetIp,
            bannedAt: parsed.bannedAt,
            banUntil: parsed.banUntil,
          };
        } else {
          // Ban expired
          localStorage.removeItem(LOCAL_BAN_STORAGE_KEY);
        }
      }
    }
  } catch (e) {
    console.warn('Local ban check error:', e);
  }

  // 2. Check Firestore IP Ban
  const userIp = targetIp || (await getUserIpAddress());
  const { db, isFirebaseActive } = initFirebase();
  if (isFirebaseActive && db && userIp && userIp !== 'unknown_ip') {
    try {
      const sanitizedIp = userIp.replace(/[.:/]/g, '_');
      const ipDocRef = doc(db, 'banned_ips', sanitizedIp);
      const snap = await getDoc(ipDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (!data.banUntilMillis || data.banUntilMillis > Date.now()) {
          // Mirror to local storage so subsequent offline checks block immediately
          try {
            localStorage.setItem(
              LOCAL_BAN_STORAGE_KEY,
              JSON.stringify({
                banned: true,
                bannedAt: data.bannedAt || new Date().toISOString(),
                banUntil: data.banUntilMillis || Date.now() + BAN_DURATION_MS,
                ip: userIp,
                reason: data.reason || 'تم حظرك. لقد تجاوزت الحد المسموح به لمحاولات الدخول. تم حظر هذا الجهاز.',
              })
            );
          } catch {}

          return {
            isBanned: true,
            reason: data.reason || 'تم حظرك. لقد تجاوزت الحد المسموح به لمحاولات الدخول. تم حظر هذا الجهاز.',
            ip: userIp,
            bannedAt: data.bannedAt,
            banUntil: data.banUntilMillis,
          };
        }
      }
    } catch (e) {
      console.warn('Firestore IP ban check note:', e);
    }
  }

  return { isBanned: false, ip: userIp };
}

export async function recordStrikeAndCheckBan(providedIp?: string): Promise<{ strikes: number; isBanned: boolean; ip: string }> {
  const currentStrikes = getStoredStrikeCount() + 1;
  setStoredStrikeCount(currentStrikes);

  const userIp = providedIp || (await getUserIpAddress());

  if (currentStrikes >= 2) {
    // 2-Strike Limit Reached: Trigger 1000-Year Ban!
    const banUntil = Date.now() + BAN_DURATION_MS;
    const banRecord = {
      banned: true,
      bannedAt: new Date().toISOString(),
      bannedAtMillis: Date.now(),
      banUntil,
      ip: userIp,
      reason: 'تم حظرك. لقد تجاوزت الحد المسموح به لمحاولات الدخول. تم حظر هذا الجهاز.',
    };

    // 1. Write to localStorage
    try {
      localStorage.setItem(LOCAL_BAN_STORAGE_KEY, JSON.stringify(banRecord));
    } catch (e) {
      console.warn('Error saving local ban:', e);
    }

    // 2. Write to Firebase Firestore in banned_ips collection
    const { db, isFirebaseActive } = initFirebase();
    if (isFirebaseActive && db && userIp && userIp !== 'unknown_ip') {
      try {
        const sanitizedIp = userIp.replace(/[.:/]/g, '_');
        await setDoc(doc(db, 'banned_ips', sanitizedIp), {
          ip: userIp,
          bannedAt: new Date().toISOString(),
          bannedAtMillis: Date.now(),
          banUntilMillis: banUntil,
          banDurationMs: BAN_DURATION_MS,
          reason: 'تم حظرك. لقد تجاوزت الحد المسموح به لمحاولات الدخول. تم حظر هذا الجهاز.',
        });
      } catch (err) {
        console.warn('Error writing banned IP to Firestore:', err);
      }
    }

    // Notify UI immediately via custom event
    window.dispatchEvent(new CustomEvent('softrose_ban_triggered', { detail: banRecord }));

    return { strikes: currentStrikes, isBanned: true, ip: userIp };
  }

  return { strikes: currentStrikes, isBanned: false, ip: userIp };
}

export async function unbanDeviceAndIp(ipToUnban?: string): Promise<void> {
  // Clear local storage ban & strike count
  try {
    localStorage.removeItem(LOCAL_BAN_STORAGE_KEY);
    localStorage.removeItem(STRIKE_COUNT_STORAGE_KEY);
  } catch {}

  const userIp = ipToUnban || (await getUserIpAddress());
  const { db, isFirebaseActive } = initFirebase();
  if (isFirebaseActive && db && userIp && userIp !== 'unknown_ip') {
    try {
      const sanitizedIp = userIp.replace(/[.:/]/g, '_');
      await deleteDoc(doc(db, 'banned_ips', sanitizedIp));
    } catch (err) {
      console.warn('Error deleting banned IP from Firestore:', err);
    }
  }

  window.dispatchEvent(new CustomEvent('softrose_ban_removed'));
}
