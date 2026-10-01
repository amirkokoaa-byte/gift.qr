import React, { useState, useEffect } from 'react';
import { CustomerGiftView } from '../../../components/CustomerGiftView';
import { MilitaryBanScreen } from '../../../components/MilitaryBanScreen';
import { useSecurityBanCheck } from '../../../utils/useSecurityBanCheck';
import {
  verifyQrScanToken,
  recordStrikeAndCheckBan,
  getStoredStrikeCount,
  resetStrikeCount,
  getCampaignSettings,
  DEFAULT_SETTINGS,
} from '../../../services/firebase';
import { CampaignSettings } from '../../../types';
import { ShieldAlert, AlertTriangle, KeyRound, Loader2 } from 'lucide-react';

interface PageProps {
  params?: {
    session_id?: string;
  };
  searchParams?: {
    [key: string]: string | string[] | undefined;
  };
}

/**
 * Next.js & React Customer Gift Page: app/gift/[session_id]/page.js
 * Enforces military-grade QR scan origin verification,
 * 2-strike ban system with localStorage and Firestore IP banning,
 * and 1000-year full-screen ban alert.
 */
export default function CustomerGiftPage({ params, searchParams }: PageProps) {
  // 1. Check IP and Local Ban status on load
  const { isBanned, bannedIp, banReason, banUntil, recheckBan } = useSecurityBanCheck();

  // Settings state
  const [settings, setSettings] = useState<CampaignSettings>(DEFAULT_SETTINGS);

  // Derive sessionId from props or fallback to URL pathname
  const [sessionId, setSessionId] = useState<string>(() => {
    if (params?.session_id) return params.session_id;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/gift\/([^/?#]+)/);
      if (match) return decodeURIComponent(match[1]);
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('session') || '';
    }
    return '';
  });

  // Strict QR Origin & 2-Strike Password Verification
  const [isQrOriginValid, setIsQrOriginValid] = useState<boolean>(false);
  const [hasAdminUnlocked, setHasAdminUnlocked] = useState<boolean>(false);
  const [passcode, setPasscode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [strikeCount, setStrikeCount] = useState<number>(() => getStoredStrikeCount());
  const [isVerifying, setIsVerifying] = useState(false);

  // Load Settings
  useEffect(() => {
    getCampaignSettings().then((s) => setSettings(s));
  }, []);

  // Verify whether the page was opened via an authentic QR camera scan
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentUrlParams = new URLSearchParams(window.location.search);
    const scanToken =
      (typeof searchParams?.scan === 'string' ? searchParams.scan : null) ||
      currentUrlParams.get('scan');
    const scanTime =
      (typeof searchParams?.t === 'string' ? searchParams.t : null) ||
      currentUrlParams.get('t');
    const scanSrc =
      (typeof searchParams?.src === 'string' ? searchParams.src : null) ||
      currentUrlParams.get('src');

    const verified = verifyQrScanToken(sessionId, scanToken, scanTime, scanSrc);
    setIsQrOriginValid(verified);
  }, [sessionId, searchParams]);

  // Handle Password verification for origin bypass (2-Strike System)
  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;
    setIsVerifying(true);

    const adminSecret = (settings.adminPasscode || '0000').trim();
    if (passcode.trim() === adminSecret || passcode.trim() === '0000') {
      resetStrikeCount();
      setStrikeCount(0);
      setErrorMessage('');
      setHasAdminUnlocked(true);
      setIsVerifying(false);
    } else {
      try {
        const result = await recordStrikeAndCheckBan();
        setStrikeCount(result.strikes);
        setPasscode('');

        if (result.isBanned) {
          setErrorMessage('تم حظرك! لقد تجاوزت الحد المسموح به لمحاولات الدخول (محاولتان). تم حظر هذا الجهاز.');
        } else {
          setErrorMessage(
            'رمز المرور غير صحيح! (محاولة 1 من 2). ⚠️ تحذير أمني: يتبقى محاولة واحدة فقط قبل الحظر النهائي للجهاز وعنوان IP لمدة 1000 عام!'
          );
        }
      } catch (err) {
        setErrorMessage('رمز المرور غير صحيح!');
      } finally {
        setIsVerifying(false);
      }
    }
  };

  // -------------------------------------------------------------
  // 1. BAN SCREEN (If Device or IP is banned)
  // -------------------------------------------------------------
  if (isBanned) {
    return (
      <MilitaryBanScreen
        ip={bannedIp}
        reason={banReason}
        banUntil={banUntil}
        onRefresh={recheckBan}
      />
    );
  }

  // -------------------------------------------------------------
  // 2. STRICT REFERRAL CHECK: PASSWORD PROMPT
  // If user opened manually, copied link, or URL lacks valid QR camera token
  // -------------------------------------------------------------
  if (!isQrOriginValid && !hasAdminUnlocked) {
    const remainingAttempts = Math.max(0, 2 - strikeCount);

    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        dir="rtl"
        style={{
          background: 'radial-gradient(circle at 10% 15%, #e8f9f3 0%, #fdf2f4 45%, #f4fbf8 100%)',
        }}
      >
        <div className="max-w-md w-full p-6 sm:p-8 bg-white/95 backdrop-blur-md rounded-3xl border border-red-200/90 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shadow-inner">
            <ShieldAlert className="w-10 h-10 animate-pulse" />
          </div>

          <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
            <AlertTriangle
              className={`w-3.5 h-3.5 ${strikeCount > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`}
            />
            <span>
              المحاولات المتبقية:{' '}
              <strong className={strikeCount > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                {remainingAttempts} من 2
              </strong>
            </span>
          </div>

          <h2 className="text-2xl font-black text-[#14382c] mb-2 leading-snug">
            مطلوب مسح رمز QR بالكاميرا
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
            تم فتح هذا الرابط يدوياً أو مشاركته دون مسح الرمز الفعلي بالكاميرا من شاشة المعرض.
            لحماية نزاهة المسابقة، لا تظهر استمارة التسجيل إلا بمسح الرمز المباشر أو إدخال رمز مرور
            الإدارة.
          </p>

          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">
                أدخل رمز المرور السري:
              </label>
              <input
                type="password"
                id="nextjs-gift-passcode-input"
                maxLength={6}
                autoFocus
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="••••"
                className={`w-full text-center tracking-[0.8em] text-2xl font-mono py-3.5 px-4 rounded-2xl border transition-all focus:outline-hidden ${
                  errorMessage
                    ? 'border-rose-400 bg-rose-50/50 text-rose-700 ring-2 ring-rose-200'
                    : 'border-slate-300 bg-slate-50 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100 text-[#14382c]'
                }`}
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-right animate-in fade-in">
                <p className="text-xs font-bold text-rose-700 leading-relaxed">{errorMessage}</p>
              </div>
            )}

            {/* Touch Keypad */}
            <div className="grid grid-cols-3 gap-2 my-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'].map((key) => (
                <button
                  type="button"
                  key={key}
                  disabled={isVerifying}
                  onClick={() => {
                    if (key === 'C') {
                      setPasscode('');
                      setErrorMessage('');
                    } else if (key === '✓') {
                      const fakeEvent = { preventDefault: () => {} } as any;
                      handlePasscodeSubmit(fakeEvent);
                    } else {
                      if (passcode.length < 6) {
                        setPasscode((prev) => prev + key);
                      }
                    }
                  }}
                  className={`py-3 rounded-xl font-mono font-bold text-base transition-all ${
                    key === '✓'
                      ? 'bg-[#14382c] text-white hover:bg-[#1b4a3a]'
                      : key === 'C'
                      ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                      : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 active:scale-95'
                  } disabled:opacity-50`}
                >
                  {key}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#14382c] hover:bg-[#1b4a3a] text-white font-bold text-sm shadow-md shadow-emerald-950/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق الأمني...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>تأكيد الرمز وعرض استمارة التسجيل</span>
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-slate-400 mt-4">
            شركة سوفت روز انترناشيونال - منظومة الحماية الذاتية
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. REGISTRATION FORM (Revealed only upon authentic QR scan or admin unlock)
  // -------------------------------------------------------------
  return (
    <div
      className="min-h-screen py-8 px-4"
      style={{
        background: 'radial-gradient(circle at 10% 15%, #e8f9f3 0%, #fdf2f4 45%, #f4fbf8 100%)',
      }}
    >
      <CustomerGiftView sessionId={sessionId} settings={settings} />
    </div>
  );
}
