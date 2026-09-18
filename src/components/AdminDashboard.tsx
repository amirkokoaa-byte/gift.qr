import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Download,
  Search,
  Sliders,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Hash,
  Layers,
  AlertTriangle,
  Code2,
  Cloud,
  Edit3,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { CustomerRecord, CampaignSettings } from '../types';
import {
  subscribeToCustomers,
  resetAllCampaignData,
  subscribeToFirebaseHealth,
  FirebaseHealthStatus,
  testAndSyncCloudData,
} from '../services/firebase';
import { exportFullReportPDF } from '../utils/pdfExport';
import { CustomerEditModal } from './CustomerEditModal';
import { FirebaseRulesGuideModal } from './FirebaseRulesGuideModal';

interface AdminDashboardProps {
  settings: CampaignSettings;
  onOpenSettings: () => void;
  onOpenQrSimulator: () => void;
  onOpenCodeDocs: () => void;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  settings,
  onOpenSettings,
  onOpenQrSimulator,
  onOpenCodeDocs,
  onLogout,
}) => {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Customer Edit Modal State
  const [selectedCustomerForEdit, setSelectedCustomerForEdit] = useState<CustomerRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Firebase Health & Sync State
  const [firebaseHealth, setFirebaseHealth] = useState<FirebaseHealthStatus>('checking');
  const [firebaseHealthDetails, setFirebaseHealthDetails] = useState('');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncBannerMsg, setCloudSyncBannerMsg] = useState<string | null>(null);

  // Subscribe to customers data (Firestore real-time snapshot or local storage)
  useEffect(() => {
    const unsubscribe = subscribeToCustomers((data) => {
      setCustomers(data);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Firebase Cloud Health
  useEffect(() => {
    const unsubHealth = subscribeToFirebaseHealth((status, details) => {
      setFirebaseHealth(status);
      setFirebaseHealthDetails(details);
    });
    return () => unsubHealth();
  }, []);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const term = searchTerm.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(term) ||
        c.phoneNumber.includes(term) ||
        String(c.giftNumber).includes(term)
    );
  }, [customers, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const min = Math.min(settings.minNumber, settings.maxNumber);
    const max = Math.max(settings.minNumber, settings.maxNumber);
    const totalCapacity = max - min + 1;
    const claimedCount = customers.length;
    const remainingCount = Math.max(0, totalCapacity - claimedCount);
    const percentage = totalCapacity > 0 ? Math.min(100, Math.round((claimedCount / totalCapacity) * 100)) : 0;

    return { totalCapacity, claimedCount, remainingCount, percentage, min, max };
  }, [customers, settings]);

  // -------------------------------------------------------------
  // PDF Export using robust isolated off-screen generator
  // -------------------------------------------------------------
  const handleExportPDF = async () => {
    if (customers.length === 0) {
      alert('لا توجد بيانات عملاء مسجلة للتصدير حالياً.');
      return;
    }

    setIsExportingPdf(true);
    try {
      await exportFullReportPDF(customers, settings, stats);
    } catch (error: any) {
      console.error('PDF Generation error:', error);
      alert(error?.message || 'حدث خطأ أثناء تصدير ملف الـ PDF. يرجى المحاولة مجدداً.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleOpenCustomerEdit = (cust: CustomerRecord) => {
    setSelectedCustomerForEdit(cust);
    setIsEditModalOpen(true);
  };

  const handleResetData = () => {
    resetAllCampaignData();
    setShowResetConfirm(false);
  };

  const handleQuickCloudSync = async () => {
    setIsSyncingCloud(true);
    setCloudSyncBannerMsg(null);
    try {
      const res = await testAndSyncCloudData();
      if (res.success) {
        setCloudSyncBannerMsg(res.message);
      } else {
        setIsRulesModalOpen(true);
      }
    } catch (e: any) {
      console.warn('Sync cloud error:', e);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      {/* ------------------------------------------------------------- */}
      {/* Top Banner & Title Bar */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-emerald-900/10 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-emerald-100/70 text-[#14382c]">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#14382c]">
              لوحة تحكم إدارة حملة الهدايا (Admin Dashboard)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mr-9">
            شركة {settings.companyName || 'سوفت روز انترناشيونال'} • إدارة النطاق، فحص وتعديل العملاء وتصدير التقارير
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Cloud Health Status Pill / Button */}
          <button
            id="cloud-status-badge-btn"
            onClick={() => setIsRulesModalOpen(true)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-2xs ${
              firebaseHealth === 'connected'
                ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900'
                : firebaseHealth === 'permission_denied'
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900 animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
            }`}
            title="انقر لفحص المزامنة السحابية وإرشادات القواعد"
          >
            <Cloud className="w-4 h-4 text-emerald-700" />
            <span>
              {firebaseHealth === 'connected'
                ? '● متصل بالسحابة (Firebase)'
                : firebaseHealth === 'permission_denied'
                ? '⚠️ القواعد مقفلة (اضغط للحل)'
                : 'حالة السحابة'}
            </span>
          </button>

          <button
            id="sync-cloud-action-btn"
            onClick={handleQuickCloudSync}
            disabled={isSyncingCloud}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-[#14382c] border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5"
            title="مزامنة كافة السجلات المحلية مع السحابة الآن"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-800 ${isSyncingCloud ? 'animate-spin' : ''}`} />
            <span>{isSyncingCloud ? 'جاري المزامنة...' : 'مزامنة السحابة'}</span>
          </button>

          <button
            id="admin-settings-modal-btn"
            onClick={onOpenSettings}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#14382c] border border-slate-200 text-xs sm:text-sm font-bold shadow-2xs transition-all flex items-center gap-2"
          >
            <Sliders className="w-4 h-4 text-emerald-700" />
            إعدادات الحملة والنطاق
          </button>

          <button
            id="admin-qr-simulator-btn"
            onClick={onOpenQrSimulator}
            className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-[#14382c] border border-emerald-200 text-xs sm:text-sm font-bold shadow-2xs transition-all flex items-center gap-2"
          >
            <QrCode className="w-4 h-4 text-emerald-800" />
            توليد وفحص رموز QR
          </button>

          <button
            id="admin-code-docs-btn"
            onClick={onOpenCodeDocs}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-2xs transition-all flex items-center gap-2"
            title="عرض أكواد Next.js و Firebase والخطوات"
          >
            <Code2 className="w-4 h-4 text-emerald-400" />
            أكواد المشروع والتعليمات
          </button>

          <button
            onClick={onLogout}
            className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all"
          >
            تسجيل خروج
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Firebase Rules Notice Alert (If permission-denied is detected) */}
      {/* ------------------------------------------------------------- */}
      {firebaseHealth === 'permission_denied' && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-black text-sm">تنبيه المزامنة السحابية الفورية: </span>
              <span className="text-xs sm:text-sm text-amber-800">
                قواعد Firestore في Firebase ترفض القراءة والكتابة (permission-denied). البيانات مسجلة على هاتف العميل فقط ولا تظهر على الكمبيوتر حالياً.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsRulesModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition-colors shadow-xs"
          >
            فتح القواعد الآن ومزامنة البيانات (دقيقة واحدة)
          </button>
        </div>
      )}

      {cloudSyncBannerMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs sm:text-sm font-bold flex items-center justify-between animate-in fade-in">
          <span>{cloudSyncBannerMsg}</span>
          <button
            onClick={() => setCloudSyncBannerMsg(null)}
            className="text-emerald-700 hover:underline font-bold text-xs"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4 Metric Stats Cards */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Claimed Gifts */}
        <div className="p-5 rounded-3xl bg-white/90 backdrop-blur-md border border-emerald-900/10 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>إجمالي الهدايا الموزعة</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-[#14382c] font-mono">
            {stats.claimedCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            تم تسجيلهم وحجز أرقامهم بنجاح
          </p>
        </div>

        {/* Card 2: Range Limits */}
        <div className="p-5 rounded-3xl bg-white/90 backdrop-blur-md border border-emerald-900/10 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>نطاق الأرقام العشوائية</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Hash className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-[#14382c] font-mono">
            {stats.min} - {stats.max}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            سعة الحملة: {stats.totalCapacity} رقم متاح
          </p>
        </div>

        {/* Card 3: Remaining */}
        <div className="p-5 rounded-3xl bg-white/90 backdrop-blur-md border border-emerald-900/10 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>الأرقام المتبقية</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-700 font-mono">
            {stats.remainingCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            أرقام هدايا لم يتم توزيعها بعد
          </p>
        </div>

        {/* Card 4: Completion */}
        <div className="p-5 rounded-3xl bg-white/90 backdrop-blur-md border border-emerald-900/10 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>نسبة إنجاز الحملة</span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-[#14382c] font-mono">
            {stats.percentage}%
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Customers Table Section */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-emerald-900/10 shadow-sm overflow-hidden">
        {/* Table Top Controls */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-lg text-[#14382c] flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700" />
              سجل العملاء المستلمين للهدايا
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              انقر على أي اسم عميل لتعديل الاسم، رقم الهاتف، أو الرمز وتصدير بطاقة الهدية الرسمية PDF
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالاسم، الهاتف أو الرمز..."
                className="w-full pl-4 pr-10 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#14382c] focus:border-[#14382c] transition-all bg-slate-50/50"
              />
            </div>

            {/* Export Full PDF Report Button */}
            <button
              id="export-pdf-table-btn"
              onClick={handleExportPDF}
              disabled={isExportingPdf || customers.length === 0}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 ${
                customers.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#14382c] hover:bg-[#1b4a3a] text-white shadow-emerald-950/15 active:scale-95'
              }`}
            >
              <Download className="w-4 h-4 text-emerald-300" />
              <span>{isExportingPdf ? 'جاري تجهيز الـ PDF...' : 'تحميل PDF'}</span>
            </button>
          </div>
        </div>

        {/* Responsive Table (Session ID column is completely removed as requested) */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold">
                <th className="py-3.5 px-4 text-center w-12">#</th>
                <th className="py-3.5 px-4">اسم العميل (Customer Name)</th>
                <th className="py-3.5 px-4">رقم الهاتف (Phone Number)</th>
                <th className="py-3.5 px-4 text-center">رقم الهدية المميز (Gift Number)</th>
                <th className="py-3.5 px-4">تاريخ وساعة المسح (Scan Date & Time)</th>
                <th className="py-3.5 px-4 text-center w-28">الإجراءات (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-sm">
                        {searchTerm ? 'لا توجد نتائج تطابق بحثك' : 'لا يوجد عملاء مسجلين بعد'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {searchTerm
                          ? 'جرّب كلمة بحث أخرى'
                          : 'يمكنك تجربة مسح رمز QR من خلال "توليد وفحص رموز QR" بالأعلى'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust, idx) => (
                  <tr
                    key={cust.id || idx}
                    onClick={() => handleOpenCustomerEdit(cust)}
                    className="hover:bg-emerald-50/50 transition-colors duration-150 cursor-pointer group"
                    title="انقر لتعديل بيانات العميل أو تصدير بطاقة الهدية PDF"
                  >
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400 text-xs">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#14382c] group-hover:text-emerald-800 flex items-center gap-2">
                      <span>{cust.customerName}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded font-normal">
                        تعديل
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 text-xs sm:text-sm" dir="ltr">
                      {cust.phoneNumber}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-xl font-mono font-black text-sm sm:text-base bg-emerald-100/80 text-[#14382c] border border-emerald-300/50 shadow-2xs">
                        #{cust.giftNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs font-medium">
                      {cust.formattedDate || new Date(cust.timestamp).toLocaleString('ar-EG')}
                    </td>
                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenCustomerEdit(cust)}
                        className="px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#14382c] border border-emerald-200 text-xs font-bold transition-all flex items-center justify-center gap-1 mx-auto"
                      >
                        <Edit3 className="w-3 h-3 text-emerald-700" />
                        <span>تعديل / PDF</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with count and reset options */}
        <div className="p-4 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div>
            إجمالي السجلات المسجلة: <span className="font-bold text-[#14382c]">{customers.length}</span> عميل
          </div>

          <div className="flex items-center gap-2">
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-rose-600 hover:text-rose-700 font-medium hover:underline flex items-center gap-1"
              >
                مسح وتصفير بيانات الحملة للتجربة
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-rose-50 p-1.5 px-3 rounded-lg border border-rose-200">
                <span className="text-rose-800 font-bold text-[11px]">هل أنت متأكد من مسح جميع السجلات؟</span>
                <button
                  onClick={handleResetData}
                  className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[11px]"
                >
                  نعم، امسح
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[11px]"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Customer Edit Modal (Edit Name, Phone, Gift Number & Export PDF) */}
      {/* ------------------------------------------------------------- */}
      <CustomerEditModal
        customer={selectedCustomerForEdit}
        settings={settings}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCustomerForEdit(null);
        }}
      />

      {/* ------------------------------------------------------------- */}
      {/* Firebase Rules Step-by-Step Guide Modal */}
      {/* ------------------------------------------------------------- */}
      <FirebaseRulesGuideModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        currentStatus={firebaseHealth}
        projectId={settings.firebaseConfig?.projectId || 'qr-soft-1f4fe'}
        onSyncSuccess={() => {
          setCloudSyncBannerMsg('تم فتح قواعد البيانات والمزامنة بنجاح! ستظهر بيانات أي مسح في الحال.');
        }}
      />
    </div>
  );
};
