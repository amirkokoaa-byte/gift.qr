import React, { useState } from 'react';
import { X, Save, FileDown, Trash2, CheckCircle2, AlertCircle, Phone, User, Gift, Clock, ShieldCheck } from 'lucide-react';
import { CustomerRecord, CampaignSettings } from '../types';
import { updateCustomerRecord, deleteCustomerRecord } from '../services/firebase';
import { exportCustomerVoucherPDF } from '../utils/pdfExport';

interface CustomerEditModalProps {
  customer: CustomerRecord | null;
  settings: CampaignSettings;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CustomerEditModal: React.FC<CustomerEditModalProps> = ({
  customer,
  settings,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !customer) return null;

  const [name, setName] = useState(customer.customerName || '');
  const [phone, setPhone] = useState(customer.phoneNumber || '');
  const [giftNumber, setGiftNumber] = useState<number | string>(customer.giftNumber);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const num = Number(giftNumber);

    if (!trimmedName) {
      setErrorMessage('يرجى إدخال اسم العميل.');
      return;
    }

    if (!trimmedPhone || trimmedPhone.length < 8) {
      setErrorMessage('يرجى إدخال رقم هاتف صحيح ومكون من 8 أرقام على الأقل.');
      return;
    }

    if (isNaN(num) || num < 1) {
      setErrorMessage('يرجى إدخال رقم هدية / رمز صحيح.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateCustomerRecord(
        customer.id,
        {
          customerName: trimmedName,
          phoneNumber: trimmedPhone,
          giftNumber: num,
        },
        customer.giftNumber
      );

      if (result.success) {
        setSuccessMessage('تم حفظ التعديلات بنجاح في السجل ومزامنتها سحابياً.');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 800);
      } else {
        setErrorMessage(result.error || 'حدث خطأ أثناء حفظ التعديلات.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'تعذر حفظ التعديلات.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportVoucher = async () => {
    setIsExportingPdf(true);
    setErrorMessage(null);
    try {
      const updatedCustomer: CustomerRecord = {
        ...customer,
        customerName: name.trim() || customer.customerName,
        phoneNumber: phone.trim() || customer.phoneNumber,
        giftNumber: Number(giftNumber) || customer.giftNumber,
      };

      await exportCustomerVoucherPDF(updatedCustomer, settings);
    } catch (err: any) {
      console.error('Customer voucher PDF error:', err);
      setErrorMessage('حدث خطأ أثناء تصدير بطاقة الهدية. يرجى المحاولة مجدداً.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const res = await deleteCustomerRecord(customer.id, customer.giftNumber, customer.sessionId);
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setErrorMessage(res.error || 'فشل حذف السجل.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء الحذف.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-[#14382c] px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700/60 border border-emerald-500/30 flex items-center justify-center text-xl shadow-inner">
              🎁
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">تعديل بيانات العميل وبطاقة الهدية</h3>
              <p className="text-xs text-emerald-200 font-medium">
                {settings.companyName || 'شركة سوفت روز انترناشيونال'}
              </p>
            </div>
          </div>

          <button
            id="close-edit-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5">
          {/* Quick info banner */}
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500">رقم الهدية المخصص حالياً</div>
              <div className="text-2xl font-black text-[#14382c] font-mono mt-0.5">
                #{giftNumber}
              </div>
            </div>
            <div className="text-left text-xs text-slate-500">
              <div className="flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                <span>{customer.formattedDate || new Date(customer.timestamp).toLocaleString('ar-EG')}</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-800 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>سجل معتمد وموثق</span>
              </div>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Field: Customer Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#14382c]" />
              <span>اسم العميل (Customer Name)</span>
            </label>
            <input
              type="text"
              id="edit-customer-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="أدخل اسم العميل بالكامل"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#14382c] focus:border-[#14382c] text-sm font-semibold text-slate-800 transition-all"
              required
            />
          </div>

          {/* Field: Phone Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-[#14382c]" />
              <span>رقم الهاتف (Phone Number)</span>
            </label>
            <input
              type="tel"
              id="edit-customer-phone-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010XXXXXXXX"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#14382c] focus:border-[#14382c] text-sm font-mono text-slate-800 transition-all text-left"
              dir="ltr"
              required
            />
          </div>

          {/* Field: Gift Number / Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-[#14382c]" />
              <span>الرمز / رقم الهدية (Gift Number)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                id="edit-customer-gift-input"
                value={giftNumber}
                onChange={(e) => setGiftNumber(e.target.value)}
                min={settings.minNumber || 1}
                max={settings.maxNumber || 99999}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#14382c] focus:border-[#14382c] text-sm font-mono font-bold text-[#14382c] transition-all text-left pl-12"
                dir="ltr"
                required
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400">
                #
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              نطاق الأرقام المتاح للحملة: [{settings.minNumber} إلى {settings.maxNumber}]
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="submit"
              id="save-customer-changes-btn"
              disabled={isSaving}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#14382c] hover:bg-[#1b4a3a] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-emerald-300" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
            </button>

            <button
              type="button"
              id="export-single-voucher-pdf-btn"
              onClick={handleExportVoucher}
              disabled={isExportingPdf}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>{isExportingPdf ? 'جاري التصدير...' : 'تصدير بطاقة الهدية PDF'}</span>
            </button>
          </div>

          {/* Secondary Options: Delete or Cancel */}
          <div className="pt-2 flex items-center justify-between text-xs">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 hover:underline"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف هذا السجل</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-rose-50 p-2 rounded-xl border border-rose-200 text-rose-800">
                <span className="font-bold text-[11px]">تأكيد الحذف وتحرير الرقم؟</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[11px]"
                >
                  نعم، احذف
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2 py-1 bg-slate-200 text-slate-700 rounded font-semibold text-[11px]"
                >
                  إلغاء
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 font-semibold px-3 py-1.5"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
