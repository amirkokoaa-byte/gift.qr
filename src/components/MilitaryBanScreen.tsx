import React, { useEffect, useState } from 'react';
import { AlertOctagon, ShieldAlert, Lock, Terminal, ShieldX, RefreshCw } from 'lucide-react';
import { unbanDeviceAndIp } from '../services/firebase';

interface MilitaryBanScreenProps {
  ip?: string;
  reason?: string;
  bannedAt?: string;
  banUntil?: number;
  onRefresh?: () => void;
}

export const MilitaryBanScreen: React.FC<MilitaryBanScreenProps> = ({
  ip,
  reason,
  bannedAt,
  banUntil,
  onRefresh,
}) => {
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [showAdminRecovery, setShowAdminRecovery] = useState<boolean>(false);
  const [recoveryPasscode, setRecoveryPasscode] = useState<string>('');
  const [recoveryError, setRecoveryError] = useState<string>('');
  const [isRecovering, setIsRecovering] = useState<boolean>(false);

  useEffect(() => {
    // Generate deterministic device code
    const ua = navigator.userAgent;
    let hash = 0x811c9dc5;
    for (let i = 0; i < ua.length; i++) {
      hash ^= ua.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    setDeviceFingerprint('SR-DEV-' + hash.toString(16).toUpperCase());
  }, []);

  const handleAdminRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryPasscode.trim() === '0000') {
      setIsRecovering(true);
      try {
        await unbanDeviceAndIp(ip);
        window.location.reload();
      } catch (err) {
        setRecoveryError('تعذر فك الحظر السحابي');
      } finally {
        setIsRecovering(false);
      }
    } else {
      setRecoveryError('رمز فك الحظر للإدارة غير صحيح');
    }
  };

  return (
    <div
      id="military-ban-screen"
      dir="rtl"
      className="fixed inset-0 z-[99999] bg-[#220000] text-red-100 flex flex-col items-center justify-center p-4 sm:p-8 select-none overflow-y-auto"
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 50%, rgba(185, 28, 28, 0.28) 0%, rgba(40, 0, 0, 0.95) 75%, #150000 100%)',
      }}
    >
      {/* Background Animated Alert Scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-15 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#ff0000_3px,#ff0000_3px)]" />

      <div className="relative max-w-xl w-full border-4 border-red-600/70 bg-black/75 backdrop-blur-md rounded-3xl p-6 sm:p-10 shadow-[0_0_80px_rgba(239,68,68,0.45)] text-center animate-in zoom-in-95 duration-300">
        
        {/* Pulsing Alert Icon */}
        <div className="relative mx-auto w-24 h-24 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-red-600/30 animate-ping duration-1000" />
          <div className="relative w-24 h-24 rounded-2xl bg-red-950 border-2 border-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.7)] animate-pulse">
            <AlertOctagon className="w-14 h-14 text-red-500 animate-bounce" />
          </div>
        </div>

        {/* Security Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-900/60 border border-red-500/50 text-red-300 text-xs font-mono font-bold tracking-wider mb-5 uppercase">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>نظام الحماية والأمان العسكري - تم تفعيل الحظر الشامل</span>
        </div>

        {/* Required Arabic Warning Text */}
        <h1 className="text-2xl sm:text-4xl font-black text-red-500 leading-tight tracking-wide mb-4 drop-shadow-[0_2px_12px_rgba(239,68,68,0.6)] animate-pulse">
          تم حظرك. لقد تجاوزت الحد المسموح به لمحاولات الدخول. تم حظر هذا الجهاز.
        </h1>

        <p className="text-sm sm:text-base text-red-200/90 leading-relaxed font-medium mb-6">
          {reason ||
            'تم رصد محاولات إدخال غير مصرح بها وتجاوز الحد الأقصى للمحاولات (محاولتان خاطئتان). تم عزل هذا الجهاز وتسجيل عنوان IP في القائمة المحظورة السحابية.'}
        </p>

        {/* Forensic Ban Details Box */}
        <div className="bg-red-950/70 border border-red-800/80 rounded-2xl p-4 sm:p-5 text-right font-mono text-xs sm:text-sm space-y-2.5 mb-6 text-red-300/90">
          <div className="flex items-center justify-between border-b border-red-900/60 pb-2">
            <span className="text-red-400 font-bold">مدة الحظر المفروضة:</span>
            <span className="text-amber-400 font-black">1000 عام (31,536,000,000 ثانية)</span>
          </div>

          <div className="flex items-center justify-between border-b border-red-900/60 pb-2">
            <span className="text-red-400 font-bold">عنوان IP المحظور:</span>
            <span className="text-white font-black tracking-wider">{ip || 'جاري التعرف...'}</span>
          </div>

          <div className="flex items-center justify-between border-b border-red-900/60 pb-2">
            <span className="text-red-400 font-bold">معرف بصمة الجهاز:</span>
            <span className="text-red-200 tracking-wider">{deviceFingerprint}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-red-400 font-bold">سجل الحظر في السحابة:</span>
            <span className="text-emerald-400 font-bold">Firestore / banned_ips [LOCKED]</span>
          </div>
        </div>

        {/* Admin Recovery Guidance Note */}
        <div className="bg-black/40 border border-red-900/40 rounded-xl p-3 text-[11px] text-red-400/80 mb-6 leading-relaxed text-right">
          <span className="font-bold text-red-300">ملاحظة لإدارة النظام (Admin Exemption):</span> إذا تم حظر المدير بالخطأ أثناء التجربة، يمكن إلغاء الحظر عبر مسح بيانات المتصفح (Clear LocalStorage)، أو استخدام التصفح الخفي (Incognito)، أو حذف وثيقة عنوان الـ IP من Firebase Console داخل مجموعة <code className="text-amber-300">banned_ips</code>.
        </div>

        {/* Quick Admin Recovery Trigger Button */}
        {!showAdminRecovery ? (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => onRefresh && onRefresh()}
              className="px-5 py-2.5 rounded-xl bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-bold transition-all flex items-center gap-2 border border-red-700/50 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة فحص حالة الحظر</span>
            </button>
            <button
              onClick={() => setShowAdminRecovery(true)}
              className="px-4 py-2.5 rounded-xl bg-black/60 hover:bg-black text-red-400/90 text-xs font-bold transition-all border border-red-900/50"
            >
              فك حظر المدير
            </button>
          </div>
        ) : (
          <form onSubmit={handleAdminRecoverySubmit} className="mt-4 p-4 rounded-2xl bg-black/80 border border-red-700 text-right animate-in fade-in duration-200">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-amber-300">
              <Lock className="w-3.5 h-3.5" />
              <span>استعادة دخول المدير (رمز الطوارئ 0000)</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                maxLength={6}
                value={recoveryPasscode}
                onChange={(e) => {
                  setRecoveryPasscode(e.target.value);
                  setRecoveryError('');
                }}
                placeholder="0000"
                className="flex-1 bg-red-950/60 border border-red-600 rounded-xl px-3 py-2 text-center text-lg font-mono text-white tracking-widest focus:outline-hidden focus:ring-2 focus:ring-red-400"
              />
              <button
                type="submit"
                disabled={isRecovering}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {isRecovering ? 'جاري الفك...' : 'تأكيد الفك'}
              </button>
              <button
                type="button"
                onClick={() => setShowAdminRecovery(false)}
                className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
            {recoveryError && (
              <p className="text-[11px] text-red-400 font-bold mt-2">{recoveryError}</p>
            )}
          </form>
        )}

      </div>
    </div>
  );
};
