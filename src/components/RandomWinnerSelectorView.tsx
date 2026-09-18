import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  Sparkles, 
  Download, 
  FileDown, 
  Users, 
  Phone, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Calendar, 
  QrCode,
  ArrowRight,
  X,
  ExternalLink,
  ChevronRight,
  Printer,
  Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { CustomerRecord, CampaignSettings, RaffleWinnerRecord } from '../types';
import { 
  subscribeToCustomers, 
  subscribeToRaffleWinners, 
  addRaffleWinner, 
  deleteRaffleWinner,
  clearAllRaffleWinners
} from '../services/firebase';
import { exportWinnersReportPDF, exportCustomerVoucherPDF } from '../utils/pdfExport';

interface RandomWinnerSelectorViewProps {
  settings: CampaignSettings;
  onGoToAdmin?: () => void;
  onGoToHomeQr?: () => void;
}

export const RandomWinnerSelectorView: React.FC<RandomWinnerSelectorViewProps> = ({
  settings,
  onGoToAdmin,
  onGoToHomeQr,
}) => {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [winners, setWinners] = useState<RaffleWinnerRecord[]>([]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [displayNumber, setDisplayNumber] = useState<number | string | null>(null);
  const [currentWinner, setCurrentWinner] = useState<CustomerRecord | null>(null);
  const [isWinnersDrawerOpen, setIsWinnersDrawerOpen] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingVoucher, setIsExportingVoucher] = useState<boolean>(false);
  const [winnerVoucherQrUrl, setWinnerVoucherQrUrl] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const spinIntervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Subscribe to real-time customers list
  useEffect(() => {
    const unsubscribeCustomers = subscribeToCustomers((list) => {
      setCustomers(list);
    });
    const unsubscribeWinners = subscribeToRaffleWinners((list) => {
      setWinners(list);
      // If we don't have an active winner displayed yet but winners exist, default to the most recent winner
      if (list.length > 0) {
        setCurrentWinner((prev) => prev || list[0].customer);
      }
    });

    return () => {
      unsubscribeCustomers();
      unsubscribeWinners();
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, []);

  // Generate QR code for the currently selected winner's voucher
  useEffect(() => {
    if (!currentWinner) {
      setWinnerVoucherQrUrl('');
      return;
    }

    const payload = `SOFTROSE-VOUCHER|${currentWinner.giftNumber}|${currentWinner.customerName}|${currentWinner.phoneNumber}`;
    QRCode.toDataURL(payload, {
      width: 180,
      margin: 1,
      color: { dark: '#14382c', light: '#ffffff' },
    })
      .then((url) => setWinnerVoucherQrUrl(url))
      .catch((err) => console.warn('Winner voucher QR render error:', err));
  }, [currentWinner]);

  // Audio helper using Web Audio API for ticking sound during shuffle
  const playTickSound = (freq = 800) => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
        }
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      if (audioContextRef.current) {
        const osc = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioContextRef.current.currentTime);
        gain.gain.setValueAtTime(0.04, audioContextRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(audioContextRef.current.destination);
        osc.start();
        osc.stop(audioContextRef.current.currentTime + 0.05);
      }
    } catch {}
  };

  // Victory fanfare sound
  const playVictoryFanfare = () => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) audioContextRef.current = new AudioContextClass();
      }
      if (audioContextRef.current) {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          setTimeout(() => {
            if (!audioContextRef.current) return;
            const osc = audioContextRef.current.createOscillator();
            const gain = audioContextRef.current.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, audioContextRef.current.currentTime);
            gain.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(audioContextRef.current.destination);
            osc.start();
            osc.stop(audioContextRef.current.currentTime + 0.4);
          }, idx * 110);
        });
      }
    } catch {}
  };

  // Trigger notification toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  // -------------------------------------------------------------
  // Exclusion of prior winners for fairness and credibility:
  // Customers who already won are excluded from the draw pool
  // -------------------------------------------------------------
  const wonCustomerIds = new Set(winners.map((w) => w.customer.id));
  const wonGiftNumbers = new Set(winners.map((w) => w.customer.giftNumber));
  const eligibleCustomers = customers.filter(
    (c) => !wonCustomerIds.has(c.id) && !wonGiftNumbers.has(c.giftNumber)
  );

  // -------------------------------------------------------------
  // Core Feature: Pick Random Winner with Fast Scrolling Animation
  // -------------------------------------------------------------
  const handlePickWinner = () => {
    if (isSpinning) return;

    if (customers.length === 0) {
      showToast('لا يوجد عملاء مسجلين في الموقع حتى الآن لإجراء السحب! يجب أن يقوم العملاء بمسح الـ QR والتسجيل أولاً.', 'error');
      return;
    }

    if (eligibleCustomers.length === 0) {
      showToast('جميع العملاء المسجلين فازوا بالفعل في السحب! يمكنك حذف فائز من السجل لإعادته للسحب.', 'error');
      return;
    }

    setIsSpinning(true);
    setCurrentWinner(null);

    // Pick a candidate randomly ONLY from eligible customers who haven't won yet
    const winningCustomer = eligibleCustomers[Math.floor(Math.random() * eligibleCustomers.length)];

    let speed = 40; // milliseconds between ticks (very fast!)
    let elapsed = 0;
    const totalDuration = 3600; // ~3.6 seconds total spin

    // Pool of numbers to flash from eligible customers
    const pool = eligibleCustomers.map((c) => c.giftNumber);

    const runShuffle = () => {
      if (spinIntervalRef.current) clearTimeout(spinIntervalRef.current);

      // Randomly display one of the eligible customer numbers
      const randNum = pool[Math.floor(Math.random() * pool.length)];
      setDisplayNumber(randNum);
      playTickSound(600 + Math.random() * 300);

      elapsed += speed;

      // Gradually decelerate towards the end
      if (elapsed > 2000) {
        speed += 28;
      } else if (elapsed > 1200) {
        speed += 12;
      }

      if (elapsed < totalDuration) {
        spinIntervalRef.current = setTimeout(runShuffle, speed);
      } else {
        // Stop precisely on winning customer's number!
        setDisplayNumber(winningCustomer.giftNumber);
        setCurrentWinner(winningCustomer);
        setIsSpinning(false);

        // Play celebration audio & confetti
        playVictoryFanfare();
        confetti({
          particleCount: 160,
          spread: 85,
          origin: { y: 0.55 },
          colors: ['#14382c', '#10b981', '#f59e0b', '#fbbf24', '#f43f5e'],
        });

        // Record winner in database and local state
        addRaffleWinner(winningCustomer)
          .then(() => {
            showToast(`مبروك للفائز: ${winningCustomer.customerName} (رقم #${winningCustomer.giftNumber})!`, 'success');
          })
          .catch((err) => {
            console.warn('Could not save raffle winner:', err);
          });
      }
    };

    runShuffle();
  };

  // -------------------------------------------------------------
  // Delete Winner from Raffle History
  // -------------------------------------------------------------
  const handleDeleteWinner = async (e: React.MouseEvent, winnerId: string, winnerName: string) => {
    e.stopPropagation();
    try {
      await deleteRaffleWinner(winnerId);
      showToast(`تم حذف الفائز (${winnerName}) من السجل بنجاح، ويمكنه المشاركة في السحب مجدداً`, 'info');
      // If the deleted winner was the one currently viewed, update the active card
      if (currentWinner && (currentWinner.id === winnerId || winners.find((w) => w.id === winnerId)?.customer.id === currentWinner.id)) {
        const remaining = winners.filter((w) => w.id !== winnerId);
        if (remaining.length > 0) {
          setCurrentWinner(remaining[0].customer);
          setDisplayNumber(remaining[0].customer.giftNumber);
        } else {
          setCurrentWinner(null);
          setDisplayNumber(null);
        }
      }
    } catch (err) {
      console.error('Delete winner error:', err);
      showToast('حدث خطأ أثناء محاولة حذف الفائز.', 'error');
    }
  };

  // -------------------------------------------------------------
  // Export Winners Report PDF
  // -------------------------------------------------------------
  const handleExportWinnersPdf = async () => {
    if (winners.length === 0) {
      showToast('لا يوجد فائزين مسجلين في السحب بعد! اضغط "اختر الفائز" أولاً.', 'error');
      return;
    }

    setIsExportingPdf(true);
    try {
      await exportWinnersReportPDF(winners, settings);
      showToast('تم تصدير تقرير الفائزين بصيغة PDF بنجاح.', 'success');
    } catch (err: any) {
      console.error('Export winners PDF error:', err);
      showToast(err?.message || 'تعذر تصدير تقرير الفائزين.', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // -------------------------------------------------------------
  // Download Customer Voucher as PDF
  // -------------------------------------------------------------
  const handleDownloadWinnerVoucherPdf = async () => {
    if (!currentWinner) return;
    setIsExportingVoucher(true);
    try {
      await exportCustomerVoucherPDF(currentWinner, settings);
      showToast('تم تحميل بطاقة الهدية بصيغة PDF بنجاح.', 'success');
    } catch (err: any) {
      console.error('Download voucher error:', err);
      showToast('حدث خطأ أثناء تحميل بطاقة الهدية.', 'error');
    } finally {
      setIsExportingVoucher(false);
    }
  };

  // -------------------------------------------------------------
  // Download Customer Voucher as PNG Image (Same as customer view)
  // -------------------------------------------------------------
  const handleDownloadWinnerVoucherPng = () => {
    if (!currentWinner) return;

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 980;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 980);
    bgGrad.addColorStop(0, '#0c241c');
    bgGrad.addColorStop(0.5, '#14382c');
    bgGrad.addColorStop(1, '#0c241c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 980);

    // Decorative Gold Border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, 760, 940);

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, 740, 920);

    // Header Branding
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Cairo", sans-serif';
    ctx.fillText(settings.companyName || 'شركة سوفت روز انترناشيونال', 400, 90);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 20px "Cairo", sans-serif';
    ctx.fillText('بطاقة استلام هدية رسمية معتمدة • الفائز بالسحب العشوائي', 400, 130);

    // Big Gift Box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.roundRect(160, 190, 480, 240, 24);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#fdf2f4';
    ctx.font = '22px "Cairo", sans-serif';
    ctx.fillText('رقم الهدية الفائز في السحب', 400, 250);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 88px "Cairo", monospace';
    ctx.fillText(`#${currentWinner.giftNumber}`, 400, 350);

    ctx.fillStyle = '#10b981';
    ctx.font = '16px "Cairo", sans-serif';
    ctx.fillText('★ موثق ومعتمد رسمياً من نظام السحب ★', 400, 400);

    // Customer Information Block
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.roundRect(120, 480, 560, 280, 20);
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Cairo", sans-serif';
    ctx.fillText('اسم العميل الفائز:', 640, 545);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Cairo", sans-serif';
    ctx.fillText(currentWinner.customerName, 420, 545);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Cairo", sans-serif';
    ctx.fillText('رقم الهاتف المسجل:', 640, 615);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Cairo", monospace';
    ctx.fillText(currentWinner.phoneNumber, 420, 615);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Cairo", sans-serif';
    ctx.fillText('تاريخ وساعة التسجيل:', 640, 685);
    ctx.fillStyle = '#10b981';
    ctx.font = '18px "Cairo", sans-serif';
    ctx.fillText(currentWinner.formattedDate || new Date(currentWinner.timestamp).toLocaleString('ar-EG'), 440, 685);

    // Footer note
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '17px "Cairo", sans-serif';
    ctx.fillText('يُرجى إبراز هذه البطاقة لدى مسؤولي المعرض أو مقر الشركة لاستلام الهدية.', 400, 830);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px monospace';
    ctx.fillText(`كود المعاملة: ${currentWinner.id} • الجلسة: ${currentWinner.sessionId || 'N/A'}`, 400, 880);

    // Download PNG
    const link = document.createElement('a');
    link.download = `بطاقة_هدية_الفائز_${currentWinner.customerName}_${currentWinner.giftNumber}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('تم تحميل صورة بطاقة الهدية PNG بنجاح.', 'success');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6" dir="rtl">
      {/* ------------------------------------------------------------- */}
      {/* Toast Notification Notification Banner                        */}
      {/* ------------------------------------------------------------- */}
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-5 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-bold ${
              notification.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-500 shadow-emerald-950/30'
                : notification.type === 'error'
                ? 'bg-rose-900 text-white border-rose-500 shadow-rose-950/30'
                : 'bg-slate-900 text-white border-slate-700 shadow-slate-950/30'
            }`}
          >
            {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {notification.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
            {notification.type === 'info' && <Sparkles className="w-5 h-5 text-amber-400" />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Top Header & Quick Actions Bar (الفائزين + تصدير PDF)          */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-emerald-900/10 shadow-sm p-4 sm:p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Title and stats */}
        <div className="flex items-center gap-3.5 text-right w-full md:w-auto">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#14382c] to-[#1b4a3a] text-amber-300 flex items-center justify-center text-2xl shadow-md shrink-0">
            <Trophy className="w-7 h-7 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[#14382c]">
                الاختيار العشوائي
              </h1>
              <span className="text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300/80 px-2.5 py-0.5 rounded-full">
                سحب الفائزين
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              إجراء القرعة السريعة بين العملاء المؤهلين ({eligibleCustomers.length} مؤهل من أصل {customers.length} عميل مسجل)
            </p>
          </div>
        </div>

        {/* Top Buttons: [الفائزين] + [تصدير PDF] + [لوحة الإدارة] */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Button: Winners List (سجل الفائزين) */}
          <button
            type="button"
            id="open-winners-list-btn"
            onClick={() => setIsWinnersDrawerOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100/80 border border-amber-300 text-amber-900 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-2xs hover:shadow-xs active:scale-95"
          >
            <Trophy className="w-4 h-4 text-amber-700" />
            <span>سجل الفائزين</span>
            <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-mono text-[11px] flex items-center justify-center">
              {winners.length}
            </span>
          </button>

          {/* Button: Export PDF (تصدير PDF) */}
          <button
            type="button"
            id="export-winners-pdf-btn"
            disabled={isExportingPdf || winners.length === 0}
            onClick={handleExportWinnersPdf}
            className="px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-300 text-emerald-900 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-2xs hover:shadow-xs disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {isExportingPdf ? (
              <div className="w-4 h-4 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 text-emerald-700" />
            )}
            <span>تصدير PDF</span>
          </button>

          {/* Quick jump to Admin Dashboard */}
          {onGoToAdmin && (
            <button
              type="button"
              onClick={onGoToAdmin}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">لوحة الإدارة</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Main Lottery / Slot Machine Drawing Section                   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-gradient-to-b from-white to-emerald-50/40 rounded-3xl border border-emerald-900/10 shadow-lg p-6 sm:p-10 mb-8 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-80 h-80 bg-amber-300/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-xl mx-auto">
          {/* Main Action Button: [اختر الفائز] */}
          <div className="mb-6">
            <button
              type="button"
              id="pick-random-winner-btn"
              disabled={isSpinning || eligibleCustomers.length === 0}
              onClick={handlePickWinner}
              className={`w-full sm:w-auto px-10 py-5 rounded-3xl font-black text-lg sm:text-xl transition-all duration-300 flex items-center justify-center gap-3 mx-auto shadow-xl active:scale-95 ${
                isSpinning
                  ? 'bg-slate-400 text-white cursor-wait'
                  : eligibleCustomers.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  : 'bg-gradient-to-r from-[#14382c] via-[#1f5442] to-[#14382c] hover:from-[#1b4a3a] hover:to-[#26634e] text-white shadow-emerald-950/25 ring-4 ring-emerald-500/20 hover:scale-[1.02]'
              }`}
            >
              {isSpinning ? (
                <>
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري تدوير الأرقام واختيار الفائز...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
                  <span>اختر الفائز (بدء السحب العشوائي)</span>
                </>
              )}
            </button>

            {customers.length === 0 ? (
              <p className="text-xs text-rose-600 font-bold mt-3">
                تنبيه: لا يوجد عملاء مسجلين حالياً. يرجى مسح رمز الـ QR وتسجيل بيانات عملاء أولاً.
              </p>
            ) : eligibleCustomers.length === 0 ? (
              <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-2xl border border-amber-200 font-bold mt-3">
                تنبيه للمصداقية: جميع العملاء المسجلين ({customers.length}) فازوا في السحب بالفعل، وتم استبعادهم لمنع التكرار. (يمكنك حذف أي فائز من "سجل الفائزين" بالأعلى لإعادته للمشاركة).
              </p>
            ) : (
              <p className="text-xs text-slate-500 font-medium mt-2">
                المؤهلون للسحب حالياً: <span className="font-bold text-emerald-800">{eligibleCustomers.length}</span> من أصل <span className="font-bold text-slate-700">{customers.length}</span> مسجل (الرقم الفائز لا يظهر مرة أخرى لضمان المصداقية)
              </p>
            )}
          </div>

          {/* ----------------------------------------------------------- */}
          {/* The Animated Fast-Rolling Number Box                        */}
          {/* ----------------------------------------------------------- */}
          <div className="my-6">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
              <span>صندوق دوران أرقام العملاء المؤهلين</span>
              {isSpinning && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
            </div>

            <div
              className={`relative mx-auto max-w-md p-8 rounded-3xl transition-all duration-500 border ${
                isSpinning
                  ? 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white border-amber-400/80 shadow-2xl ring-4 ring-amber-400/30'
                  : currentWinner
                  ? 'bg-gradient-to-b from-[#14382c] to-[#0c241c] text-white border-emerald-500/60 shadow-2xl ring-4 ring-emerald-400/30'
                  : 'bg-gradient-to-b from-slate-50 to-slate-100 text-slate-400 border-slate-200 shadow-inner'
              }`}
            >
              {/* Spinning status badge */}
              {isSpinning && (
                <div className="absolute top-3 left-3 flex items-center gap-1 text-[11px] font-black text-amber-300 bg-amber-400/20 px-3 py-0.5 rounded-full border border-amber-400/40 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  دوران وحركة سريعة...
                </div>
              )}

              {currentWinner && !isSpinning && (
                <div className="absolute top-3 left-3 flex items-center gap-1 text-[11px] font-black text-emerald-300 bg-emerald-500/20 px-3 py-0.5 rounded-full border border-emerald-400/30 animate-in fade-in">
                  <Trophy className="w-3.5 h-3.5 text-amber-300" />
                  الفائز المختار!
                </div>
              )}

              {/* The Scrolling Numbers Display */}
              <div className="my-4 flex items-center justify-center font-mono">
                <span
                  className={`text-6xl sm:text-7xl font-black tracking-widest transition-all duration-75 ${
                    isSpinning
                      ? 'scale-110 text-amber-300 blur-[0.3px]'
                      : currentWinner
                      ? 'scale-100 text-amber-300 animate-in zoom-in-75'
                      : 'text-slate-300'
                  }`}
                >
                  {displayNumber !== null ? `#${displayNumber}` : '????'}
                </span>
              </div>

              <p className="text-xs sm:text-sm font-semibold opacity-90">
                {isSpinning
                  ? 'تتحرك الأرقام بسرعة فائقة وتتباطأ تدريجياً لتستقر على فائز جديد لم يفز من قبل...'
                  : currentWinner
                  ? `تم سحب رقم الفائز: ${currentWinner.customerName}`
                  : `أرقام العملاء المؤهلين في السحب: ${eligibleCustomers.length} رقم (بدون تكرار)`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* The Gift Claim Voucher Card (بطاقة استلام الهدية)             */}
      {/* Mandate: Displays directly below the chosen number            */}
      {/* ------------------------------------------------------------- */}
      {currentWinner && (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>بطاقة استلام الهدية الخاصة بالفائز (التي حملها العميل بعد الإسكان)</span>
            </div>
          </div>

          <div
            id="winner-voucher-card"
            className="max-w-2xl mx-auto bg-gradient-to-b from-white to-emerald-50/50 rounded-3xl border-2 border-emerald-600/30 shadow-2xl p-6 sm:p-8 relative overflow-hidden"
          >
            {/* Top Certificate Ribbon & Branding */}
            <div className="border-b-2 border-emerald-900/20 pb-5 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#14382c] text-white flex items-center justify-center text-2xl shadow-md">
                  🌹
                </div>
                <div className="text-right">
                  <h3 className="font-black text-lg sm:text-xl text-[#14382c]">
                    {settings.companyName || 'شركة سوفت روز انترناشيونال'}
                  </h3>
                  <p className="text-xs text-emerald-700 font-bold">
                    بطاقة استلام هدية رسمية معتمدة • Official Gift Voucher
                  </p>
                </div>
              </div>

              <div className="text-left">
                <span className="inline-block px-3 py-1 rounded-xl bg-[#14382c] text-amber-300 font-mono text-xs font-black shadow-xs">
                  VERIFIED #WINNER
                </span>
              </div>
            </div>

            {/* Giant Gift Number Box inside Voucher */}
            <div className="text-center mb-6">
              <div className="text-xs font-bold text-slate-500 mb-1">
                رقم الهدية المميز والفريد المحجوز للعميل
              </div>
              <div className="inline-block px-8 py-3 rounded-2xl bg-gradient-to-r from-[#14382c] to-[#0c241c] text-amber-300 font-mono text-4xl sm:text-5xl font-black tracking-widest border-2 border-amber-400 shadow-lg">
                #{currentWinner.giftNumber}
              </div>
              <div className="text-[11px] text-emerald-700 font-bold mt-2">
                ★ موثق إلكترونياً وغير مكرر في قاعدة البيانات ★
              </div>
            </div>

            {/* Customer Details Grid */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs mb-6 text-right">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-bold block">اسم العميل المستلم:</span>
                    <span className="text-base font-black text-slate-900">{currentWinner.customerName}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-bold block">رقم الهاتف المسجل:</span>
                    <span className="text-base font-black text-slate-900 font-mono" dir="ltr">{currentWinner.phoneNumber}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-bold block">تاريخ وساعة المسح:</span>
                    <span className="text-xs font-bold text-slate-800">
                      {currentWinner.formattedDate || new Date(currentWinner.timestamp).toLocaleString('ar-EG')}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-bold block">معرف المعاملة والجلسة:</span>
                    <span className="text-[11px] font-mono text-slate-600 truncate block max-w-[180px]">
                      {currentWinner.id}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Verification QR & Instructions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-950 text-white">
              <div className="text-right">
                <div className="text-xs font-extrabold text-amber-300 mb-1">
                  تعليمات الاستلام الرسمية:
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed max-w-sm">
                  يُرجى إبراز هذه البطاقة لدى مسؤولي جناح سوفت روز انترناشيونال أو مقر الشركة لاستلام الهدية. صالحة لمرة واحدة فقط وموثقة إلكترونياً.
                </p>
              </div>

              {winnerVoucherQrUrl && (
                <div className="bg-white p-2 rounded-xl text-center shrink-0">
                  <img
                    src={winnerVoucherQrUrl}
                    alt="QR Verification"
                    className="w-18 h-18 object-contain"
                  />
                  <span className="text-[9px] font-black text-slate-800 block mt-1">كود التحقق</span>
                </div>
              )}
            </div>

            {/* Voucher Download Actions */}
            <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleDownloadWinnerVoucherPdf}
                disabled={isExportingVoucher}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#14382c] hover:bg-[#1b4a3a] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                {isExportingVoucher ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 text-emerald-300" />
                )}
                <span>تحميل بطاقة الهدية (PDF)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadWinnerVoucherPng}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                <Download className="w-4 h-4 text-emerald-200" />
                <span>تحميل بطاقة الهدية (صورة PNG)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Winners List Modal / Drawer (سجل الفائزين)                     */}
      {/* Mandate: When clicking a winner name, display their voucher    */}
      {/* ------------------------------------------------------------- */}
      {isWinnersDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-emerald-900/10 shadow-2xl text-right flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl">
                  🏆
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-[#14382c]">
                    سجل الفائزين في السحب
                  </h3>
                  <p className="text-xs text-slate-500">
                    اضغط على اسم أي فائز لعرض بطاقته، أو اضغط زر الحذف لحذف أي اسم من السجل
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsWinnersDrawerOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Action Row: PDF export + stats */}
            <div className="flex items-center justify-between mb-4 bg-slate-50 p-3 rounded-2xl">
              <div className="text-xs font-bold text-slate-700">
                إجمالي الفائزين: <span className="font-mono text-emerald-800 text-sm font-black">{winners.length}</span> فائز
              </div>

              {winners.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportWinnersPdf}
                  disabled={isExportingPdf}
                  className="px-3 py-1.5 rounded-xl bg-[#14382c] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#1b4a3a]"
                >
                  <FileDown className="w-3.5 h-3.5 text-amber-300" />
                  <span>تصدير السجل PDF</span>
                </button>
              )}
            </div>

            {/* Winners List Scroll Container */}
            <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
              {winners.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Trophy className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-bold text-slate-600">لا يوجد فائزين في السجل بعد</p>
                  <p className="text-xs text-slate-400 mt-1">اضغط على زر "اختر الفائز" لإجراء السحب الأول</p>
                </div>
              ) : (
                winners.map((item, index) => {
                  const isSelected = currentWinner?.id === item.customer.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setCurrentWinner(item.customer);
                        setDisplayNumber(item.customer.giftNumber);
                        setIsWinnersDrawerOpen(false);
                        showToast(`تم عرض بطاقة العميل: ${item.customer.customerName}`, 'info');
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300 shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900 font-mono font-black text-xs flex items-center justify-center shrink-0">
                          {index + 1}
                        </div>

                        <div>
                          <div className="font-black text-sm text-[#14382c] group-hover:text-emerald-900 flex items-center gap-2">
                            <span>{item.customer.customerName}</span>
                            {isSelected && (
                              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.2 rounded-full font-bold">
                                معروض حالياً
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-2" dir="ltr">
                            <span>{item.customer.phoneNumber}</span>
                            <span>•</span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(item.wonAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 font-mono font-black text-xs border border-amber-300 shrink-0">
                          #{item.customer.giftNumber}
                        </span>

                        {/* Delete button for this winner */}
                        <button
                          type="button"
                          title="حذف هذا الاسم من سجل الفائزين"
                          onClick={(e) => handleDeleteWinner(e, item.id, item.customer.customerName)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 transition-transform group-hover:-translate-x-1 shrink-0" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsWinnersDrawerOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
