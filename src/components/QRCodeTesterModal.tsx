import React, { useState } from 'react';
import { QrCode, X, ExternalLink, Plus, CheckCircle2, Lock, Sparkles, Copy, Check } from 'lucide-react';
import { createNewSessionId } from '../services/firebase';

interface QRCodeTesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string;
  onSelectSession: (sessionId: string) => void;
}

export const QRCodeTesterModal: React.FC<QRCodeTesterModalProps> = ({
  isOpen,
  onClose,
  currentSessionId,
  onSelectSession,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generate a list of quick demo sessions
  const [recentSessions, setRecentSessions] = useState<string[]>([
    'sr_booth_gift_1',
    'sr_booth_gift_2',
    'sr_booth_gift_3',
    currentSessionId,
  ]);

  if (!isOpen) return null;

  const handleCreateNewSession = () => {
    const newId = createNewSessionId();
    setRecentSessions([newId, ...recentSessions]);
    onSelectSession(newId);
  };

  const handleCopyLink = (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}?session=${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-emerald-900/10 shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-100 text-[#14382c]">
              <QrCode className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-black text-[#14382c]">
                محاكي فحص رموز QR (QR Code Simulator)
              </h3>
              <p className="text-xs text-slate-500">
                اختبار سيناريوهات المسح الجديد وقفل الرابط عند تكرار الفتح
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Current Active QR Session Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-rose-50 border border-emerald-900/10">
            <div className="text-xs font-bold text-slate-600 mb-1">رمز الجلسة المعروض حالياً:</div>
            <div className="font-mono text-sm font-bold text-[#14382c] break-all bg-white p-2.5 rounded-xl border border-emerald-900/10 mb-2">
              {currentSessionId}
            </div>
            <p className="text-[11px] text-slate-500">
              يمثل هذا الرابط الوجهة الحقيقية التي يدخل إليها العميل عند مسح كود QR مطبوع: <code className="text-emerald-800">/gift/[session_id]</code>
            </p>
          </div>

          {/* Action: Generate New Session */}
          <button
            onClick={handleCreateNewSession}
            className="w-full py-3 px-4 rounded-2xl bg-[#14382c] hover:bg-[#1b4a3a] text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <Plus className="w-4 h-4 text-emerald-300" />
            توليد كود QR جديد ونشط (جلسة عميل جديدة)
          </button>

          {/* Preset / Recent Sessions List */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2.5">
              جلسات وأكواد QR للتجربة:
            </h4>
            <div className="space-y-2">
              {Array.from(new Set(recentSessions)).map((sid) => {
                const isCurrent = sid === currentSessionId;
                return (
                  <div
                    key={sid}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                      isCurrent
                        ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <QrCode className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="font-mono text-xs font-bold text-slate-800 truncate" dir="ltr">
                        {sid}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 shrink-0">
                          النشط الآن
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCopyLink(sid)}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-[#14382c] text-xs font-medium"
                        title="نسخ الرابط"
                      >
                        {copiedId === sid ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {!isCurrent && (
                        <button
                          onClick={() => {
                            onSelectSession(sid);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#14382c] hover:bg-[#1b4a3a] text-white text-xs font-bold transition-colors"
                        >
                          اختبار المسح
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
