import React, { useState, useEffect, useRef } from 'react';
import { Gift, Sparkles, Download, CheckCircle2, AlertCircle, Phone, User, Lock, ArrowRight, Share2, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CampaignSettings, SessionRecord } from '../types';
import { claimGiftWithUniqueNumber, getSessionRecord } from '../services/firebase';

interface CustomerGiftViewProps {
  sessionId: string;
  settings: CampaignSettings;
  onRefreshSession?: () => void;
  onGoToSimulator?: () => void;
  onClaimCompleted?: (claimData: { sessionId: string; customerName: string; phoneNumber: string; giftNumber: number }) => void;
  onRequireAdminPasscode?: (reason: string) => void;
}

export const CustomerGiftView: React.FC<CustomerGiftViewProps> = ({
  sessionId,
  settings,
  onRefreshSession,
  onGoToSimulator,
  onClaimCompleted,
  onRequireAdminPasscode,
}) => {
  // Form State
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string }>({});

  // Session & Claim States
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSessionLocked, setIsSessionLocked] = useState(false);
  const [lockedSessionData, setLockedSessionData] = useState<SessionRecord | null>(null);

  // Animation & Execution States
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [finalGiftNumber, setFinalGiftNumber] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isClaimCompleted, setIsClaimCompleted] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const animationIntervalRef = useRef<any>(null);

  // Check initial session status on load
  useEffect(() => {
    let isMounted = true;
    async function checkCurrentSession() {
      setIsCheckingSession(true);
      try {
        // Check if this device has already claimed a gift previously
        const rawDeviceClaim = localStorage.getItem('softrose_device_claimed');
        if (rawDeviceClaim) {
          try {
            const deviceClaim = JSON.parse(rawDeviceClaim);
            if (deviceClaim && deviceClaim.claimed) {
              if (deviceClaim.sessionId === sessionId) {
                // If it's the exact same session, restore their claimed gift card
                setCustomerName(deviceClaim.customerName || '');
                setPhoneNumber(deviceClaim.phoneNumber || '');
                setFinalGiftNumber(deviceClaim.giftNumber || null);
                setDisplayNumber(deviceClaim.giftNumber || null);
                setIsClaimCompleted(true);
              } else {
                // Different session! The customer changed the link in the URL or scanned another QR code!
                if (onRequireAdminPasscode) {
                  onRequireAdminPasscode('تم تعديل رابط الجلسة أو محاولة إجراء مسح جديد بعد استلام الهدية مسبقاً من هذا الهاتف.');
                }
                if (isMounted) setIsCheckingSession(false);
                return;
              }
            }
          } catch (e) {
            console.warn('Error reading device claim:', e);
          }
        }

        const session = await getSessionRecord(sessionId);
        if (isMounted) {
          if (session && session.status === 'used') {
            setIsSessionLocked(true);
            setLockedSessionData(session);
          } else {
            setIsSessionLocked(false);
            setLockedSessionData(null);
          }
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        if (isMounted) setIsCheckingSession(false);
      }
    }

    checkCurrentSession();
    return () => {
      isMounted = false;
      if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
    };
  }, [sessionId]);

  // Form validation
  const validateForm = () => {
    const errors: { name?: string; phone?: string } = {};
    const trimmedName = customerName.trim();
    const trimmedPhone = phoneNumber.trim();

    if (!trimmedName) {
      errors.name = 'يرجى إدخال الاسم الكريم';
    } else if (trimmedName.length < 3) {
      errors.name = 'يجب أن يحتوي الاسم على 3 أحرف على الأقل';
    }

    if (!trimmedPhone) {
      errors.phone = 'يرجى إدخال رقم الهاتف';
    } else if (!/^[0-9+ ]{8,15}$/.test(trimmedPhone)) {
      errors.phone = 'يرجى إدخال رقم هاتف صحيح (8 إلى 15 رقماً)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Trigger spinning number animation and atomic Firebase transaction
  const handleStartSpin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSpinning || isClaimCompleted) return;

    if (!validateForm()) return;

    setErrorMessage(null);
    setIsSpinning(true);

    const min = Math.min(settings.minNumber, settings.maxNumber);
    const max = Math.max(settings.minNumber, settings.maxNumber);

    // Dynamic spinning animation loop:
    // Starts fast (30ms interval) then gradually slows down
    let currentSpeed = 35;
    let currentDisplayVal = Math.floor(Math.random() * (max - min + 1)) + min;
    setDisplayNumber(currentDisplayVal);

    // Call backend / Firebase transaction concurrently while spinning begins
    const transactionPromise = claimGiftWithUniqueNumber(
      sessionId,
      customerName.trim(),
      phoneNumber.trim()
    );

    let allocatedGiftNumber: number | null = null;
    let transactionError: string | null = null;
    let sessionAlreadyUsed = false;

    transactionPromise
      .then((res) => {
        if (res.success && res.giftNumber) {
          allocatedGiftNumber = res.giftNumber;
        } else {
          transactionError = res.error || 'حدث خطأ أثناء حجز رقم الهدية.';
          if (res.isUsed) sessionAlreadyUsed = true;
        }
      })
      .catch((err) => {
        transactionError = err?.message || 'حدث خطأ أثناء معالجة الطلب.';
      });

    // Spinning decelerating sequence
    let elapsedSteps = 0;
    const totalSpinTimeMs = 3800; // 3.8 seconds graceful spin
    const startTime = Date.now();

    const spinStep = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / totalSpinTimeMs, 1);

      // Random temporary number in range
      currentDisplayVal = Math.floor(Math.random() * (max - min + 1)) + min;
      setDisplayNumber(currentDisplayVal);
      elapsedSteps++;

      // Gradual deceleration curve (exponential ease-out)
      currentSpeed = 35 + Math.pow(progress, 2.5) * 380;

      if (progress < 1 || allocatedGiftNumber === null) {
        // If transaction failed early
        if (transactionError) {
          setIsSpinning(false);
          if (sessionAlreadyUsed) {
            setIsSessionLocked(true);
          } else {
            setErrorMessage(transactionError);
          }
          return;
        }

        animationIntervalRef.current = setTimeout(spinStep, currentSpeed);
      } else {
        // Stop animation on the exact allocated unique number!
        setDisplayNumber(allocatedGiftNumber);
        setFinalGiftNumber(allocatedGiftNumber);
        setIsSpinning(false);
        setIsClaimCompleted(true);

        // Store claim on this device to protect against URL tampering and re-scanning
        const claimPayload = {
          claimed: true,
          sessionId,
          customerName: customerName.trim(),
          phoneNumber: phoneNumber.trim(),
          giftNumber: allocatedGiftNumber,
          claimedAt: Date.now(),
        };
        try {
          localStorage.setItem('softrose_device_claimed', JSON.stringify(claimPayload));
        } catch (e) {
          console.warn('Could not save device claim:', e);
        }

        if (onClaimCompleted) {
          onClaimCompleted(claimPayload);
        }

        // Trigger celebratory confetti effect!
        confetti({
          particleCount: 110,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#14382c', '#4ecdc4', '#f3a6b2', '#fdf2f4', '#f59e0b'],
        });
      }
    };

    animationIntervalRef.current = setTimeout(spinStep, currentSpeed);
  };

  // Download digital voucher card / image or text voucher
  const handleDownloadDetails = () => {
    if (!finalGiftNumber) return;

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Gradient (Dark Forest Green to Soft Rose)
    const gradient = ctx.createLinearGradient(0, 0, 800, 1000);
    gradient.addColorStop(0, '#0d281f');
    gradient.addColorStop(0.4, '#14382c');
    gradient.addColorStop(0.85, '#1e4839');
    gradient.addColorStop(1, '#f7cad3');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 1000);

    // Outer decorative border
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, 740, 940);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, 720, 920);

    // Header Branding
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Cairo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(settings.companyName || 'سوفت روز انترناشيونال', 400, 110);

    ctx.fillStyle = '#4ecdc4';
    ctx.font = '20px "Cairo", sans-serif';
    ctx.fillText('بطاقة استلام الهدية الرسمية - Soft Rose Gift Voucher', 400, 150);

    // Decorative Line
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.4)';
    ctx.beginPath();
    ctx.moveTo(100, 180);
    ctx.lineTo(700, 180);
    ctx.stroke();

    // Gift Number Golden/Mint Box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.roundRect(120, 230, 560, 260, 24);
    ctx.fill();
    ctx.strokeStyle = '#f3a6b2';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#fdf2f4';
    ctx.font = '22px "Cairo", sans-serif';
    ctx.fillText('رقم الهدية المميز والفريد', 400, 285);

    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 88px "Cairo", monospace';
    ctx.fillText(String(finalGiftNumber), 400, 395);

    ctx.fillStyle = '#f3a6b2';
    ctx.font = '16px "Cairo", sans-serif';
    ctx.fillText('★ موثق إلكترونياً وغير مكرر ★', 400, 445);

    // Customer Information Block
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.roundRect(120, 530, 560, 260, 18);
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Cairo", sans-serif';
    ctx.fillText('اسم العميل:', 640, 590);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Cairo", sans-serif';
    ctx.fillText(customerName, 420, 590);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Cairo", sans-serif';
    ctx.fillText('رقم الهاتف:', 640, 660);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Cairo", sans-serif';
    ctx.fillText(phoneNumber, 420, 660);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Cairo", sans-serif';
    ctx.fillText('تاريخ وساعة المسح:', 640, 730);
    ctx.fillStyle = '#4ecdc4';
    ctx.font = '18px "Cairo", sans-serif';
    ctx.fillText(new Date().toLocaleString('ar-EG'), 480, 730);

    // Footer Terms & QR Session Note
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '17px "Cairo", sans-serif';
    ctx.fillText('يرجى إبراز هذه البطاقة لدى مسؤولي المعرض أو مقر الشركة لاستلام هديتك.', 400, 850);
    ctx.fillStyle = '#64748b';
    ctx.font = '14px monospace';
    ctx.fillText(`كود الجلسة: ${sessionId}`, 400, 890);

    // Download PNG
    const link = document.createElement('a');
    link.download = `SoftRose_Gift_${finalGiftNumber}_${customerName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // -------------------------------------------------------------
  // Render Loading State
  // -------------------------------------------------------------
  if (isCheckingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 border-4 border-emerald-800 border-t-emerald-300 rounded-full animate-spin mb-4"></div>
        <p className="text-lg font-bold text-[#14382c]">جاري التحقق من صلاحية رمز الهدية...</p>
        <p className="text-sm text-slate-500 mt-1">سوفت روز انترناشيونال</p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render Scan Lock State (Mandated text in Arabic)
  // -------------------------------------------------------------
  if (isSessionLocked) {
    return (
      <div className="max-w-xl mx-auto my-8 p-6 sm:p-10 bg-white/90 backdrop-blur-md rounded-3xl border border-rose-200/80 shadow-xl shadow-rose-950/5 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-inner">
          <Lock className="w-10 h-10 animate-bounce" />
        </div>

        {/* The Exact Arabic Text Mandated by the Prompt */}
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#14382c] mb-3 leading-snug">
          تم الحصول على الهدية مسبقاً، لا يمكن إعادة فتح المسح
        </h2>

        <p className="text-sm sm:text-base text-slate-600 mb-8 max-w-md mx-auto leading-relaxed">
          عذراً، هذا الرابط مخصص للاستخدام لمرة واحدة فقط وقد تم تسجيله مسبقاً في قاعدة بيانات شركة سوفت روز انترناشيونال.
        </p>

        {lockedSessionData?.claimedBy && (
          <div className="mb-8 p-5 bg-gradient-to-br from-emerald-50/60 to-rose-50/60 rounded-2xl border border-emerald-900/10 text-right">
            <div className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              تفاصيل المطالبة المسجلة:
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500 block text-xs">الاسم:</span>
                <span className="font-bold text-[#14382c]">{lockedSessionData.claimedBy.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">رقم الهدية:</span>
                <span className="font-extrabold text-emerald-700 font-mono text-base">
                  #{lockedSessionData.claimedBy.giftNumber}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onGoToSimulator && (
            <button
              onClick={onGoToSimulator}
              className="px-6 py-3 rounded-xl bg-[#14382c] hover:bg-[#1b4a3a] text-white font-bold text-sm transition-all shadow-md shadow-emerald-950/15 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              تجربة رمز QR جديد (محاكي الفحص)
            </button>
          )}
          {onRefreshSession && (
            <button
              onClick={onRefreshSession}
              className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all"
            >
              إعادة فحص الرابط
            </button>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render Customer QR Gift Page Form & Spinning Animation
  // -------------------------------------------------------------
  return (
    <div className="max-w-2xl mx-auto my-6 px-4">
      {/* Visual Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#14382c] via-[#1b4a3a] to-[#285d4b] text-white p-6 sm:p-8 shadow-xl shadow-emerald-950/15 mb-6 border border-emerald-700/30">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,rgba(112,214,182,0.15),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-xs text-xs font-semibold text-emerald-200 mb-3 border border-white/10">
            <Gift className="w-4 h-4 text-rose-300" />
            حملة الهدايا الكبرى المباشرة
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-2 tracking-tight">
            مرحباً بك في {settings.companyName || 'سوفت روز انترناشيونال'}
          </h2>
          <p className="text-sm sm:text-base text-emerald-100/90 max-w-lg mx-auto leading-relaxed">
            سجّل بياناتك أدناه واضغط للحصول على رقم هديتك المميز والفريد مباشرة دون تكرار!
          </p>
        </div>
      </div>

      {/* Main Interactive Card */}
      <div
        ref={cardRef}
        className="bg-white/95 backdrop-blur-md rounded-3xl border border-emerald-900/10 shadow-lg p-6 sm:p-8 transition-all"
      >
        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Customer Input Form (Disabled after claim) */}
        <form onSubmit={handleStartSpin} className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-[#14382c] mb-1.5">
              الاسم الكامل <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="customer-name-input"
                disabled={isSpinning || isClaimCompleted}
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="أدخل اسمك الكريم (مثال: أحمد محمد)"
                className={`w-full px-4 py-3.5 pr-11 rounded-2xl text-sm border transition-all focus:outline-hidden ${
                  formErrors.name
                    ? 'border-rose-300 bg-rose-50/50 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                    : 'border-slate-200 bg-slate-50/50 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100'
                } ${isClaimCompleted ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
              />
              <User className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
            </div>
            {formErrors.name && (
              <p className="text-xs text-rose-600 mt-1 font-medium">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-[#14382c] mb-1.5">
              رقم الهاتف المحمول <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                id="customer-phone-input"
                disabled={isSpinning || isClaimCompleted}
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                placeholder="01xxxxxxxxx أو +20xxxxxxxxx"
                dir="ltr"
                className={`w-full px-4 py-3.5 pl-11 rounded-2xl text-sm text-right border transition-all focus:outline-hidden ${
                  formErrors.phone
                    ? 'border-rose-300 bg-rose-50/50 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                    : 'border-slate-200 bg-slate-50/50 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100'
                } ${isClaimCompleted ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
              />
              <Phone className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
            {formErrors.phone && (
              <p className="text-xs text-rose-600 mt-1 font-medium">{formErrors.phone}</p>
            )}
          </div>

          {/* Action Trigger Button */}
          {!isClaimCompleted && (
            <button
              type="submit"
              id="spin-number-btn"
              disabled={isSpinning}
              className={`w-full mt-2 py-4 px-6 rounded-2xl font-black text-base sm:text-lg transition-all duration-300 flex items-center justify-center gap-2.5 shadow-lg ${
                isSpinning
                  ? 'bg-slate-400 text-white cursor-wait'
                  : 'bg-gradient-to-r from-[#14382c] via-[#1b4a3a] to-[#14382c] hover:from-[#1b4a3a] hover:to-[#235846] text-white shadow-emerald-950/20 active:scale-[0.99]'
              }`}
            >
              {isSpinning ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  <span>جاري تدوير واختيار رقم هديتك الفريد...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                  <span>اضغط لسحب وتدوير رقم الهدية</span>
                </>
              )}
            </button>
          )}
        </form>

        {/* ------------------------------------------------------------- */}
        {/* Dynamic Spinning Number Animation Box */}
        {/* ------------------------------------------------------------- */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            صندوق رقم الهدية العشوائي الفريد
          </div>

          <div
            className={`relative mx-auto max-w-sm p-6 sm:p-8 rounded-3xl transition-all duration-500 border ${
              isClaimCompleted
                ? 'bg-gradient-to-b from-[#14382c] to-[#0c241c] text-white border-emerald-600/50 shadow-2xl shadow-emerald-950/30 ring-4 ring-emerald-500/20'
                : isSpinning
                ? 'bg-gradient-to-b from-slate-900 to-slate-800 text-white border-amber-400/50 shadow-xl ring-4 ring-amber-400/20'
                : 'bg-gradient-to-b from-slate-50 to-slate-100 text-slate-400 border-slate-200'
            }`}
          >
            {/* Spinning Indicator */}
            {isSpinning && (
              <div className="absolute top-3 left-3 flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-400/30 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                تدوير سريع...
              </div>
            )}

            {isClaimCompleted && (
              <div className="absolute top-3 left-3 flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                تم الحجز بنجاح
              </div>
            )}

            {/* The Animated Number Display */}
            <div className="my-3 flex items-center justify-center font-mono">
              <span
                className={`text-5xl sm:text-6xl font-black tracking-widest transition-transform duration-75 ${
                  isSpinning
                    ? 'scale-110 text-amber-300 blur-[0.3px]'
                    : isClaimCompleted
                    ? 'scale-100 text-emerald-300 animate-in zoom-in-75'
                    : 'text-slate-300'
                }`}
              >
                {displayNumber !== null ? displayNumber : '????'}
              </span>
            </div>

            <p className="text-xs sm:text-sm font-medium opacity-90">
              {isSpinning
                ? 'يتباطأ الدوران تدريجياً ليتوقف على رقمك الخاص...'
                : isClaimCompleted
                ? 'مبروك! تم حجز هذا الرقم باسمك في قاعدة البيانات'
                : `نطاق الأرقام: ${settings.minNumber} إلى ${settings.maxNumber}`}
            </p>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Download & Lock Action Section */}
          {/* ------------------------------------------------------------- */}
          {isClaimCompleted && finalGiftNumber !== null && (
            <div className="mt-6 p-6 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 animate-in fade-in-50 slide-in-from-bottom-3 duration-500">
              <div className="flex items-center justify-center gap-2 text-emerald-800 font-extrabold text-base mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                تم تثبيت هديتك وقفل رمز المسح بنجاح!
              </div>
              <p className="text-xs text-slate-600 mb-5 max-w-md mx-auto">
                احفظ بطاقة الهدية على هاتفك الآن؛ لن تتمكن من إعادة فتح هذا الرابط مرة أخرى بعد مغادرة الصفحة.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {/* Download Button */}
                <button
                  id="download-gift-voucher-btn"
                  onClick={handleDownloadDetails}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-[#14382c] hover:from-emerald-700 hover:to-[#0e271e] text-white font-bold text-sm shadow-md shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  تحميل بطاقة الهدية على الهاتف (صورة PNG)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
