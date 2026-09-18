export interface CustomerRecord {
  id: string;
  sessionId: string;
  customerName: string;
  phoneNumber: string;
  giftNumber: number;
  timestamp: string; // ISO string
  formattedDate: string;
  claimedAtMillis: number;
}

export interface CampaignSettings {
  companyName: string;
  companyNameEn?: string;
  logoUrl: string;
  minNumber: number;
  maxNumber: number;
  adminPasscode: string;
  firebaseConfig?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
  };
}

export interface SessionRecord {
  sessionId: string;
  status: 'active' | 'scanned' | 'used';
  scannedAt?: string;
  scannedAtMillis?: number;
  claimedBy?: {
    name: string;
    phone: string;
    giftNumber: number;
    timestamp: string;
  };
  createdAt: string;
}

export interface GenerationResult {
  success: boolean;
  giftNumber?: number;
  error?: string;
  isUsed?: boolean;
}

export interface RaffleWinnerRecord {
  id: string;
  customer: CustomerRecord;
  wonAt: string;
  wonAtMillis: number;
}
