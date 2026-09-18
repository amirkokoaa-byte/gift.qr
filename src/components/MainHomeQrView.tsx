import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, Sparkles, RefreshCw, Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { CampaignSettings } from '../types';
import { createNewSessionId } from '../services/firebase';

interface MainHomeQrViewProps {
  currentSessionId: string;
  settings: CampaignSettings;
  onOpenCustomerViewOnDevice: () => void;
  onGenerateNewSession: (newSessionId: string) => void;
  isAdminLoggedIn?: boolean;
}

export const MainHomeQrView: React.FC<MainHomeQrViewProps> = ({
  currentSessionId,
  settings,
  onOpenCustomerViewOnDevice,
  onGenerateNewSession,
  isAdminLoggedIn = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  // Generate the real QR Code URL that points to the customer's gift session
  useEffect(() => {
    // Current public/app URL with session query parameter
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const fullUrl = `${origin}${pathname}?session=${encodeURIComponent(currentSessionId)}`;
    setTargetUrl(fullUrl);

    // Render High Quality QR Code Data URL with company brand dark forest green color
    QRCode.toDataURL(fullUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: '#14382c', // Soft Rose primary Forest Green
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR Generation error:', err);
      });
  }, [currentSessionId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleNewQr = () => {
    const newId = createNewSessionId();
    onGenerateNewSession(newId);
  };

  return (
    <div className="max-w-3xl mx-auto my-6 px-4 animate-in fade-in duration-300">
      {/* Main Stand & Visual Presentation Card */}
      <div className="relative bg-white/95 backdrop-blur-md rounded-3xl border border-emerald-900/10 shadow-2xl overflow-hidden p-6 sm:p-10 text-center">
        {/* Soft Rose Top Decorative Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-900/10 text-xs sm:text-sm font-bold text-[#14382c] mb-4">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>منصة توزيع هدايا شركة {settings.companyName || 'سوفت روز انترناشيونال'}</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-[#14382c] tracking-tight mb-2">
          امسح الكود واستلم هديتك فوراً
        </h2>
        <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto mb-8 leading-relaxed">
          وجّه كاميرا هاتفك المحمول نحو رمز الاستجابة السريعة (QR) بالأسفل لتفتح لك صفحة سحب وتدوير الهدية مباشرة على هاتفك!
        </p>

        {/* ------------------------------------------------------------- */}
        {/* The QR Code Container Box with Mandated "SCAN ME" Sub-caption */}
        {/* ------------------------------------------------------------- */}
        <div className="relative inline-block mx-auto mb-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white via-emerald-50/40 to-rose-50/40 border-2 border-emerald-900/20 shadow-xl shadow-emerald-950/10 group transition-all duration-300 hover:shadow-2xl">
          {/* Subtle Corner Brackets for Scanner look */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-emerald-700 rounded-tl-sm pointer-events-none" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-emerald-700 rounded-tr-sm pointer-events-none" />
          <div className="absolute bottom-10 left-3 w-4 h-4 border-b-2 border-l-2 border-emerald-700 rounded-bl-sm pointer-events-none" />
          <div className="absolute bottom-10 right-3 w-4 h-4 border-b-2 border-r-2 border-emerald-700 rounded-br-sm pointer-events-none" />

          {/* QR Image */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto bg-white p-3 rounded-2xl shadow-inner border border-emerald-900/10 flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Scan QR Code to receive Soft Rose Gift"
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <div className="w-12 h-12 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" />
            )}

            {/* Center Brand Badge on QR */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-xl bg-white/95 border-2 border-emerald-800 shadow-md flex items-center justify-center">
                <span className="text-xl">🌹</span>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Exact Mandated Text Under the QR: "SCAN ME" */}
          {/* ------------------------------------------------------------- */}
          <div className="mt-4 pt-3 border-t border-emerald-900/10 text-center">
            <div
              id="qr-scan-me-label"
              className="inline-flex items-center justify-center gap-2 px-6 py-2 rounded-2xl bg-gradient-to-r from-[#14382c] via-[#1f4f3e] to-[#14382c] text-white font-black tracking-widest text-lg sm:text-xl shadow-md uppercase transition-transform group-hover:scale-105"
            >
              <Smartphone className="w-5 h-5 text-emerald-300 animate-bounce" />
              <span>SCAN ME</span>
            </div>
            <p className="text-[11px] font-bold text-emerald-800 mt-1.5">
              امسح الكود بكاميرا الهاتف للمشاركة
            </p>
          </div>
        </div>

        {/* Action helper button for testing directly in the browser (Admin only) */}
        {isAdminLoggedIn && (
          <div className="max-w-md mx-auto space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                onClick={onOpenCustomerViewOnDevice}
                id="open-customer-view-btn"
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#14382c] hover:bg-[#1b4a3a] text-white font-bold text-sm shadow-md shadow-emerald-950/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <ExternalLink className="w-4 h-4 text-emerald-300" />
                <span>فتح صفحة العميل مباشرة هنا للتجربة</span>
              </button>

              <button
                onClick={handleNewQr}
                id="generate-new-qr-btn"
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#14382c] border border-emerald-200 font-bold text-sm transition-all flex items-center justify-center gap-2"
                title="توليد كود QR لجلسة عميل جديدة"
              >
                <RefreshCw className="w-4 h-4 text-emerald-700" />
                <span>توليد كود QR جديد</span>
              </button>
            </div>

            {/* Copyable direct URL */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 overflow-hidden text-slate-600 font-mono text-[11px] truncate" dir="ltr">
                <span className="text-emerald-700 font-bold shrink-0">رابط المسح:</span>
                <span className="truncate">{targetUrl}</span>
              </div>
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 font-bold text-slate-700 text-xs flex items-center gap-1 shrink-0 transition-colors"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'تم النسخ' : 'نسخ الرابط'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Security & One-Time Note */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>
            كود المسح مؤمن بقفل المعاملة الذرية: يُقفل تلقائياً بمجرد إتمام السحب لمنع تكرار الفتح.
          </span>
        </div>
      </div>
    </div>
  );
};
