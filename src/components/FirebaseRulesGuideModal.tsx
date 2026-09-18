import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, RefreshCw, ShieldAlert, CheckCircle2, Cloud } from 'lucide-react';
import { testAndSyncCloudData, FirebaseHealthStatus } from '../services/firebase';

interface FirebaseRulesGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus: FirebaseHealthStatus;
  projectId?: string;
  onSyncSuccess?: () => void;
}

export const FirebaseRulesGuideModal: React.FC<FirebaseRulesGuideModalProps> = ({
  isOpen,
  onClose,
  currentStatus,
  projectId = 'qr-soft-1f4fe',
  onSyncSuccess,
}) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);

  const recommendedRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(recommendedRules);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTestAndSync = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testAndSyncCloudData();
      setTestResult(res);
      if (res.success) {
        onSyncSuccess?.();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'فشل الاتصال بـ Firebase.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="bg-[#14382c] px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700/60 border border-emerald-500/30 flex items-center justify-center text-xl shadow-inner">
              <Cloud className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">دليل تشغيل المزامنة السحابية الفورية</h3>
              <p className="text-xs text-emerald-200 font-medium">
                ظهور البيانات لحظياً بين هاتف العميل والكمبيوتر ولوحة الإدارة
              </p>
            </div>
          </div>

          <button
            id="close-rules-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-sm">
          {/* Explanation Alert */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-black text-amber-900 text-sm">لماذا لم تظهر البيانات على الكمبيوتر؟</div>
              <p className="text-xs text-amber-800 leading-relaxed">
                عند إنشاء قاعدة بيانات في <strong>Firebase Console</strong>، تضع جوجل تلقائياً قواعد حماية مغلقة تمنع القراءة والكتابة (<code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-950">permission-denied</code>).
                لذلك عندما قام العميل بعمل اسكان، تم حفظ البيانات على هاتفه فقط وتعذر إرسالها للسحابة لكي يراها الكمبيوتر.
              </p>
            </div>
          </div>

          {/* Steps list */}
          <div className="space-y-3">
            <div className="font-black text-slate-800 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#14382c] text-white flex items-center justify-center text-xs font-bold">1</span>
              <span>خطوات فتح القواعد في دقيقة واحدة (Firebase Console):</span>
            </div>

            <ol className="space-y-2.5 text-xs text-slate-600 list-decimal list-inside pr-2 font-medium">
              <li>
                افتح منصة{' '}
                <a
                  href={`https://console.firebase.google.com/project/${projectId}/firestore/rules`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
                >
                  Firebase Console - Firestore Rules <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                من القائمة الجانبية اختر <strong>Firestore Database</strong> ثم اضغط على تبويب <strong>Rules (القواعد)</strong> في الأعلى.
              </li>
              <li>
                استبدل النص الموجود بالكامل بالنص التالي (المربع بالأسفل).
              </li>
              <li>
                اضغط على زر <strong>Publish (نشر)</strong> الأزرق في أعلى يمين الشاشة.
              </li>
            </ol>
          </div>

          {/* Code snippet block */}
          <div className="relative rounded-2xl bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-hidden border border-slate-800" dir="ltr">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400 font-sans text-[11px]">
              <span>firestore.rules</span>
              <button
                type="button"
                id="copy-firestore-rules-btn"
                onClick={handleCopyRules}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center gap-1 font-sans transition-colors active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ بنجاح!' : 'نسخ الكود'}</span>
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre leading-relaxed text-emerald-300 selection:bg-emerald-800 selection:text-white">
{recommendedRules}
            </pre>
          </div>

          {/* Test and Sync Button */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              id="test-cloud-connection-btn"
              onClick={handleTestAndSync}
              disabled={isTesting}
              className="w-full py-3 px-4 rounded-xl bg-[#14382c] hover:bg-[#1b4a3a] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-300 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'جاري فحص الاتصال والمزامنة...' : 'فحص الاتصال والمزامنة الآن'}</span>
            </button>
          </div>

          {/* Test Feedback */}
          {testResult && (
            <div
              className={`p-4 rounded-2xl border text-xs font-bold flex items-start gap-2.5 animate-in fade-in ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div>{testResult.message}</div>
                {testResult.success && (
                  <p className="text-[11px] text-emerald-700 font-medium">
                    تم تفعيل المزامنة اللحظية بالكامل. أي عملية مسح من أي هاتف ستظهر على الفور في شاشة الإدارة على الكمبيوتر!
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
