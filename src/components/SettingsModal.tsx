import React, { useState, useRef } from 'react';
import { X, Upload, Check, Sliders, Image, Hash, Building2, Key, Shield, Sparkles } from 'lucide-react';
import { CampaignSettings } from '../types';
import { saveCampaignSettings, uploadLogo } from '../services/firebase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: CampaignSettings;
  onSettingsUpdated: (newSettings: CampaignSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSettingsUpdated,
}) => {
  const [companyName, setCompanyName] = useState(currentSettings.companyName);
  const [companyNameEn, setCompanyNameEn] = useState(currentSettings.companyNameEn || '');
  const [minNumber, setMinNumber] = useState(currentSettings.minNumber);
  const [maxNumber, setMaxNumber] = useState(currentSettings.maxNumber);
  const [logoUrl, setLogoUrl] = useState(currentSettings.logoUrl);
  const [adminPasscode, setAdminPasscode] = useState(currentSettings.adminPasscode || '0000');

  // Firebase Config (Optional direct setup)
  const [showFirebaseConfig, setShowFirebaseConfig] = useState(false);
  const [firebaseConfigText, setFirebaseConfigText] = useState(
    currentSettings.firebaseConfig ? JSON.stringify(currentSettings.firebaseConfig, null, 2) : ''
  );

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Logo file selection & upload (to Firebase Storage or Base64)
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('يرجى اختيار ملف صورة صالح (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 4 ميجابايت');
      return;
    }

    setErrorMsg(null);
    setIsUploadingLogo(true);
    try {
      const uploadedUrl = await uploadLogo(file);
      setLogoUrl(uploadedUrl);
    } catch (err: any) {
      setErrorMsg('فشل رفع الشعار: ' + (err.message || 'حدث خطأ'));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const min = Number(minNumber);
    const max = Number(maxNumber);

    if (isNaN(min) || isNaN(max)) {
      setErrorMsg('يرجى إدخال قيم صحيحة للحد الأدنى والأقصى.');
      return;
    }

    if (min >= max) {
      setErrorMsg('يجب أن يكون الحد الأدنى للأرقام أقل من الحد الأقصى.');
      return;
    }

    if (min < 1) {
      setErrorMsg('يجب أن يكون الحد الأدنى 1 على الأقل.');
      return;
    }

    let parsedFirebaseConfig: any = currentSettings.firebaseConfig;
    if (firebaseConfigText.trim()) {
      try {
        parsedFirebaseConfig = JSON.parse(firebaseConfigText.trim());
      } catch {
        setErrorMsg('صيغة إعدادات Firebase غير صحيحة (يجب أن تكون JSON صالحة).');
        return;
      }
    }

    setIsSaving(true);
    try {
      const updated: CampaignSettings = {
        ...currentSettings,
        companyName: companyName.trim() || 'سوفت روز انترناشيونال',
        companyNameEn: companyNameEn.trim(),
        logoUrl: logoUrl.trim(),
        minNumber: min,
        maxNumber: max,
        adminPasscode: adminPasscode.trim() || '0000',
        firebaseConfig: parsedFirebaseConfig,
      };

      await saveCampaignSettings(updated);
      onSettingsUpdated(updated);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMsg('فشل حفظ الإعدادات: ' + (err.message || 'خطأ غير متوقع'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-emerald-900/10 shadow-2xl">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-100/80 text-[#14382c]">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-black text-[#14382c]">
                إعدادات الحملة والشعار والنطاق
              </h3>
              <p className="text-xs text-slate-500">
                تخصيص هوية سوفت روز انترناشيونال وضبط الأرقام العشوائية
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Company Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-700" />
              اسم الشركة (بالعربية)
            </label>
            <input
              type="text"
              id="settings-company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="مثال: سوفت روز انترناشيونال"
              className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-bold text-[#14382c]"
            />
          </div>

          {/* Company Name (English subtitle) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              اسم الشركة (بالإنجليزية - اختياري)
            </label>
            <input
              type="text"
              id="settings-company-name-en"
              value={companyNameEn}
              onChange={(e) => setCompanyNameEn(e.target.value)}
              placeholder="Soft Rose International"
              dir="ltr"
              className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* Company Logo Upload (Firebase Storage / Base64) */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Image className="w-4 h-4 text-emerald-700" />
                شعار الشركة (Company Logo)
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                (يحفظ في Firebase Storage)
              </span>
            </label>

            <div className="flex items-center gap-4">
              {/* Logo Preview */}
              <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-emerald-900/20 bg-white flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-2xl">🌹</span>
                )}
              </div>

              {/* Upload Action */}
              <div className="flex-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  id="upload-logo-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-emerald-50 text-[#14382c] border border-emerald-900/20 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{isUploadingLogo ? 'جاري رفع الشعار...' : 'اختيار ورفع شعار جديد'}</span>
                </button>
                <p className="text-[11px] text-slate-500 mt-1">
                  يدعم صيغ PNG, JPG, WebP أو SVG بحد أقصى 4 ميجابايت.
                </p>
              </div>
            </div>
          </div>

          {/* Random Number Range (Min and Max inputs) */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-900/10">
            <label className="block text-xs font-bold text-[#14382c] mb-2 flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-emerald-700" />
              نطاق الأرقام العشوائية لهدايا العملاء (Min & Max)
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              كل رقم يُسحب سيكون من داخل هذا النطاق بدقة، ولن يتكرر لأي عميل آخر إطلاقاً بواسطة معاملات Firebase.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  الحد الأدنى (Min Number)
                </label>
                <input
                  type="number"
                  id="settings-min-number"
                  value={minNumber}
                  onChange={(e) => setMinNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono font-bold text-center border border-slate-200 bg-white focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  الحد الأقصى (Max Number)
                </label>
                <input
                  type="number"
                  id="settings-max-number"
                  value={maxNumber}
                  onChange={(e) => setMaxNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono font-bold text-center border border-slate-200 bg-white focus:outline-hidden focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="text-[11px] font-semibold text-emerald-800 mt-2 text-center">
              السعة الإجمالية: {Math.max(0, maxNumber - minNumber + 1)} رقماً فريداً متاحاً للتوزيع
            </div>
          </div>

          {/* Admin Passcode */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-emerald-700" />
              رمز دخول المدير (Admin Passcode)
            </label>
            <input
              type="password"
              id="settings-admin-passcode"
              value={adminPasscode}
              onChange={(e) => setAdminPasscode(e.target.value)}
              placeholder="••••"
              className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-200 font-mono tracking-widest focus:outline-hidden focus:border-emerald-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">رمز مرور سري لحماية لوحة الإدارة والإعدادات</p>
          </div>

          {/* Firebase Custom Credentials (Accordion / Collapsible) */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowFirebaseConfig(!showFirebaseConfig)}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5"
            >
              <span>{showFirebaseConfig ? '▼' : '◀'}</span>
              <span>ربط مشروع Firebase مخصص (اختياري)</span>
            </button>

            {showFirebaseConfig && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-900 text-slate-200 text-xs">
                <p className="text-[11px] text-slate-400 mb-2">
                  ألصق كود كائن إعدادات Firebase الخاص بمشروعك (firebaseConfig JSON):
                </p>
                <textarea
                  rows={4}
                  value={firebaseConfigText}
                  onChange={(e) => setFirebaseConfigText(e.target.value)}
                  placeholder={`{\n  "apiKey": "AIzaSy...",\n  "projectId": "softrose-gift",\n  "storageBucket": "..."\n}`}
                  className="w-full bg-slate-950 text-emerald-300 font-mono text-[11px] p-2 rounded-lg border border-slate-800 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all"
            >
              إلغاء
            </button>

            <button
              type="submit"
              id="save-settings-button"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-[#14382c] hover:bg-[#1b4a3a] text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/15 transition-all flex items-center gap-2"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>تم الحفظ بنجاح!</span>
                </>
              ) : isSaving ? (
                <span>جاري الحفظ...</span>
              ) : (
                <span>حفظ التعديلات</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
