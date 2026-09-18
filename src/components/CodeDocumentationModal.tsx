import React, { useState } from 'react';
import { X, Code2, Copy, Check, Terminal, FileCode, GitBranch, CloudUpload, ShieldCheck } from 'lucide-react';

interface CodeDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CodeDocumentationModal: React.FC<CodeDocumentationModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'setup' | 'firebase' | 'transaction' | 'customer' | 'admin' | 'deploy'>('setup');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 text-slate-100 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-800 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Code2 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                ملفات المشروع والأكواد خطوة بخطوة (Production Next.js & Firebase)
              </h3>
              <p className="text-xs text-slate-400">
                شركة سوفت روز انترناشيونال • الجاهزية للنشر على GitHub و Vercel
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-2 p-3 bg-slate-950/50 border-b border-slate-800 text-xs font-bold scrollbar-none">
          {[
            { id: 'setup', label: '1. أوامر التثبيت والإعداد', icon: Terminal },
            { id: 'firebase', label: '2. ملف firebase.js', icon: FileCode },
            { id: 'transaction', label: '3. دوال المعاملات والأمان', icon: ShieldCheck },
            { id: 'customer', label: '4. مكون العميل والتدوير', icon: FileCode },
            { id: 'admin', label: '5. لوحة تحكم المدير والـ PDF', icon: FileCode },
            { id: 'deploy', label: '6. النشر على GitHub & Vercel', icon: CloudUpload },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-sm text-right font-sans" dir="rtl">
          {activeTab === 'setup' && (
            <div className="space-y-4">
              <h4 className="text-base font-bold text-emerald-400">خطوة 1: إنشاء مشروع Next.js وتثبيت الحزم</h4>
              <p className="text-slate-300 text-xs sm:text-sm">
                قم بتشغيل الأوامر التالية في سطر الأوامر (Terminal) لإنشاء تطبيق Next.js 14+ مع App Router و Tailwind CSS وتثبيت مكتبات Firebase و jsPDF و canvas-confetti:
              </p>
              
              <div className="relative group">
                <pre className="bg-slate-950 text-emerald-300 p-4 rounded-2xl font-mono text-xs overflow-x-auto border border-slate-800 text-left" dir="ltr">
{`# 1. إنشاء تطبيق Next.js مع App Router و Tailwind CSS
npx create-next-app@latest softrose-gift-distribution --typescript --tailwind --eslint --app

# 2. الانتقال إلى مجلد المشروع
cd softrose-gift-distribution

# 3. تثبيت حزم Firebase و jsPDF و Lucide Icons و Canvas Confetti
npm install firebase jspdf jspdf-autotable lucide-react canvas-confetti motion
npm install -D @types/canvas-confetti`}
                </pre>
                <button
                  onClick={() => copyToClipboard(`npx create-next-app@latest softrose-gift-distribution --typescript --tailwind --eslint --app\ncd softrose-gift-distribution\nnpm install firebase jspdf jspdf-autotable lucide-react canvas-confetti motion\nnpm install -D @types/canvas-confetti`, 'setup')}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5"
                >
                  {copiedKey === 'setup' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'setup' ? 'تم النسخ' : 'نسخ الأوامر'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'firebase' && (
            <div className="space-y-4">
              <h4 className="text-base font-bold text-emerald-400">خطوة 2: تهيئة Firebase في ملف src/lib/firebase.js (أو .ts)</h4>
              <p className="text-slate-300 text-xs sm:text-sm">
                قم بإنشاء ملف تهيئة اتصالات Firebase Firestore و Firebase Storage مع استخدام المتغيرات البيئية لضمان الأمان العالي:
              </p>

              <div className="relative group">
                <pre className="bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-xs overflow-x-auto border border-slate-800 text-left" dir="ltr">
{`// src/lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// منع إعادة التهيئة عند Hot Reload
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);`}
                </pre>
                <button
                  onClick={() => copyToClipboard(`import { initializeApp, getApps, getApp } from "firebase/app";\nimport { getFirestore } from "firebase/firestore";\nimport { getStorage } from "firebase/storage";\n\nconst firebaseConfig = {\n  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,\n  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,\n  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,\n  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,\n  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,\n  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,\n};\n\nconst app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);\nexport const db = getFirestore(app);\nexport const storage = getStorage(app);`, 'fb')}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5"
                >
                  {copiedKey === 'fb' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>نسخ الكود</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'transaction' && (
            <div className="space-y-4">
              <h4 className="text-base font-bold text-emerald-400">خطوة 3: دوال المعاملات الذرية لمنع التكرار وقفل الجلسة (Firebase Transactions)</h4>
              <p className="text-slate-300 text-xs sm:text-sm">
                تستخدم دالة <code className="text-emerald-400">runTransaction</code> لضمان عدم تخصيص نفس الرقم لأكثر من مستخدم عالمياً، وقفل الجلسة فورياً لمنع تكرار مسح رمز الـ QR:
              </p>

              <div className="relative group">
                <pre className="bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-xs overflow-x-auto border border-slate-800 text-left" dir="ltr">
{`// src/lib/giftService.js
import { db } from './firebase';
import { doc, runTransaction, collection } from 'firebase/firestore';

export async function claimGiftWithUniqueTransaction(sessionId, customerName, phoneNumber, minRange = 1000, maxRange = 9999) {
  return await runTransaction(db, async (transaction) => {
    // 1. التحقق من حالة رمز الجلسة (Session Lock Check)
    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await transaction.get(sessionRef);

    if (sessionSnap.exists() && sessionSnap.data()?.status === 'used') {
      throw new Error('تم الحصول على الهدية مسبقاً، لا يمكن إعادة فتح المسح');
    }

    // 2. قراءة سجل الأرقام المحجوزة
    const registryRef = doc(db, 'campaign_metadata', 'allocated_registry');
    const registrySnap = await transaction.get(registryRef);
    let allocated = registrySnap.exists() ? registrySnap.data().allocated || {} : {};

    // 3. التحقق من السعة وتوليد رقم عشوائي فريد
    const capacity = maxRange - minRange + 1;
    if (Object.keys(allocated).length >= capacity) {
      throw new Error('نفدت جميع أرقام الهدايا المتاحة في هذا النطاق.');
    }

    let candidate = null;
    let attempts = 0;
    while (attempts < 200) {
      const rand = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;
      if (!allocated[String(rand)]) {
        candidate = rand;
        break;
      }
      attempts++;
    }

    if (candidate === null) {
      for (let n = minRange; n <= maxRange; n++) {
        if (!allocated[String(n)]) {
          candidate = n;
          break;
        }
      }
    }

    // 4. حجز الرقم وقفل الجلسة ذرياً
    allocated[String(candidate)] = true;
    transaction.set(registryRef, { allocated, updatedAt: new Date().toISOString() }, { merge: true });

    // قفل الجلسة (Session Lock)
    transaction.set(sessionRef, {
      sessionId,
      status: 'used',
      claimedBy: { name: customerName, phone: phoneNumber, giftNumber: candidate },
      claimedAt: new Date().toISOString()
    }, { merge: true });

    // حفظ سجل العميل في مجموعة customers
    const customerRef = doc(collection(db, 'customers'));
    transaction.set(customerRef, {
      id: customerRef.id,
      sessionId,
      customerName,
      phoneNumber,
      giftNumber: candidate,
      createdAt: new Date().toISOString()
    });

    return { success: true, giftNumber: candidate };
  });
}`}
                </pre>
                <button
                  onClick={() => copyToClipboard(`// Firebase transaction code\nimport { db } from './firebase';\nimport { doc, runTransaction, collection } from 'firebase/firestore';\n// ...`, 'tx')}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5"
                >
                  {copiedKey === 'tx' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>نسخ الكود</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'customer' && (
            <div className="space-y-4">
              <h4 className="text-base font-bold text-emerald-400">خطوة 4: صفحة العميل وتأثير تدوير الأرقام (app/gift/[session_id]/page.jsx)</h4>
              <p className="text-slate-300 text-xs sm:text-sm">
                صفحة العميل مع مؤقت التدوير المتدرج للسرعة (Exponential Deceleration) وزر حفظ البطاقة وشاشة القفل:
              </p>
              <p className="text-xs text-slate-400">
                انظر المكون الحي المنفذ في <code className="text-emerald-400">src/components/CustomerGiftView.tsx</code> والذي يتضمن أيضاً توليد كرت الهدية عبر Canvas وتنزيله كصورة عالية الجودة بالإضافة إلى مؤثرات الاحتفال Confetti!
              </p>
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="space-y-4">
              <h4 className="text-base font-bold text-emerald-400">خطوة 5: لوحة تحكم المدير وتصدير تقرير PDF (app/admin/page.jsx)</h4>
              <p className="text-slate-300 text-xs sm:text-sm">
                لوحة تحكم كاملة محمية برمز مرور سري للإدارة، تتضمن جدول عملاء متجاوب مع بحث وتصدير تقرير احترافي عبر jsPDF و jspdf-autotable.
              </p>
              <p className="text-xs text-slate-400">
                انظر المكون المنفذ في <code className="text-emerald-400">src/components/AdminDashboard.tsx</code> والمربوط مباشرة بالبيانات اللحظية.
              </p>
            </div>
          )}

          {activeTab === 'deploy' && (
            <div className="space-y-4">
              <h4 className="text-base font-bold text-emerald-400">خطوة 6: الرفع على GitHub والنشر الفوري على Vercel</h4>
              
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm mb-2">
                    <GitBranch className="w-4 h-4 text-emerald-400" />
                    1. رفع الكود على مستودع GitHub:
                  </div>
                  <pre className="text-emerald-300 font-mono text-xs overflow-x-auto text-left" dir="ltr">
{`git init
git add .
git commit -m "feat: Soft Rose Gift Distribution System complete"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/softrose-gift-distribution.git
git push -u origin main`}
                  </pre>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm mb-2">
                    <CloudUpload className="w-4 h-4 text-emerald-400" />
                    2. النشر الفوري عبر Vercel:
                  </div>
                  <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5 leading-relaxed">
                    <li>ادخل إلى <span className="text-white font-semibold">vercel.com</span> وسجل الدخول بحساب GitHub.</li>
                    <li>اضغط على <span className="text-white font-semibold">Add New Project</span> واختر مستودع <span className="text-emerald-400">softrose-gift-distribution</span>.</li>
                    <li>في قسم <span className="text-white font-semibold">Environment Variables</span>، أضف مفاتيح Firebase:
                      <code className="block bg-slate-900 p-2 rounded text-emerald-300 text-[11px] my-1 text-left" dir="ltr">
                        NEXT_PUBLIC_FIREBASE_API_KEY=...<br />
                        NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
                      </code>
                    </li>
                    <li>اضغط <span className="text-emerald-400 font-bold">Deploy</span> وسيصبح التطبيق متاحاً عالمياً برابط دائم في أقل من دقيقة!</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
