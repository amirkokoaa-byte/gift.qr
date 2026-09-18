import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Download,
  Search,
  Settings,
  Sliders,
  Sparkles,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Hash,
  Phone,
  Calendar,
  Layers,
  Database,
  FileSpreadsheet,
  AlertTriangle,
  Code2,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { CustomerRecord, CampaignSettings } from '../types';
import { subscribeToCustomers, resetAllCampaignData } from '../services/firebase';

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
  const printableReportRef = useRef<HTMLDivElement>(null);

  // Subscribe to customers data (Firestore real-time snapshot or local storage)
  useEffect(() => {
    const unsubscribe = subscribeToCustomers((data) => {
      setCustomers(data);
    });
    return () => unsubscribe();
  }, []);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const term = searchTerm.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(term) ||
        c.phoneNumber.includes(term) ||
        String(c.giftNumber).includes(term) ||
        (c.sessionId && c.sessionId.toLowerCase().includes(term))
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
  // PDF Export using html2canvas and jsPDF for crystal clear Arabic rendering
  // -------------------------------------------------------------
  const handleExportPDF = async () => {
    if (customers.length === 0) {
      alert('لا توجد بيانات عملاء مسجلة للتصدير حالياً.');
      return;
    }

    if (!printableReportRef.current) {
      alert('حدث خطأ في تحميل قالب التقرير.');
      return;
    }

    setIsExportingPdf(true);
    try {
      const element = printableReportRef.current;
      
      // Temporarily make it visible for rendering with full dimensions
      element.style.display = 'block';

      const canvas = await html2canvas(element, {
        scale: 2, // High resolution (retina crisp)
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
      });

      // Restore hidden display
      element.style.display = 'none';

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Multi-page handling if customer list is long
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`تقرير_حملة_سوفت_روز_${Date.now()}.pdf`);
    } catch (error) {
      console.error('PDF Generation error:', error);
      alert('حدث خطأ أثناء تصدير ملف الـ PDF. يرجى المحاولة مجدداً.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleResetData = () => {
    resetAllCampaignData();
    setShowResetConfirm(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner & Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-emerald-900/10 shadow-xs">
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
            شركة {settings.companyName || 'سوفت روز انترناشيونال'} • إدارة النطاق، فحص العملاء وتصدير التقارير
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
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
            سعة النطاق: {stats.totalCapacity} رقماً متاحاً
          </p>
        </div>

        {/* Card 3: Remaining capacity */}
        <div className="p-5 rounded-3xl bg-white/90 backdrop-blur-md border border-emerald-900/10 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>الأرقام المتبقية في النطاق</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-[#14382c] font-mono">
            {stats.remainingCount}
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
        </div>

        {/* Card 4: Database & Security Status */}
        <div className="p-5 rounded-3xl bg-white/90 backdrop-blur-md border border-emerald-900/10 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>حالة المعاملات والأمان</span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <Database className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-base font-bold text-emerald-800">
              معاملات ذرية نشطة
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            تمنع التكرار عالمياً (Transactions)
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Customers Data Table Section */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-emerald-900/10 shadow-md overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-[#14382c] flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
              سجل العملاء المستلمين للهدايا
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono">
                {filteredCustomers.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              بيانات المسح اللحظية المسجلة عبر رموز QR لشركة سوفت روز انترناشيونال
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <input
                type="text"
                placeholder="بحث بالاسم، الهاتف أو رقم الهدية..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2 px-3.5 pr-9 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>

            {/* Prominent PDF Export Button (Mandated in Prompt) */}
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

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold">
                <th className="py-3.5 px-4 text-center w-12">#</th>
                <th className="py-3.5 px-4">اسم العميل (Customer Name)</th>
                <th className="py-3.5 px-4">رقم الهاتف (Phone Number)</th>
                <th className="py-3.5 px-4 text-center">رقم الهدية المميز (Gift Number)</th>
                <th className="py-3.5 px-4">تاريخ وساعة المسح (Scan Date & Time)</th>
                <th className="py-3.5 px-4">رمز الجلسة (Session ID)</th>
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
                        {searchTerm ? 'جرّب كلمة بحث أخرى' : 'يمكنك تجربة مسح رمز QR من خلال "محاكي الـ QR" بالأعلى'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust, idx) => (
                  <tr
                    key={cust.id || idx}
                    className="hover:bg-emerald-50/40 transition-colors duration-150"
                  >
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400 text-xs">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#14382c]">
                      {cust.customerName}
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
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 truncate max-w-[140px]" title={cust.sessionId}>
                      {cust.sessionId || 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with reset options */}
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
                  className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[11px]"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Hidden Printable HTML Template for Flawless Arabic PDF Render */}
      {/* ------------------------------------------------------------- */}
      <div
        ref={printableReportRef}
        style={{ display: 'none', width: '1100px' }}
        className="bg-white text-slate-800 p-8 font-sans"
        dir="rtl"
      >
        {/* Header Branding */}
        <div className="flex items-center justify-between pb-6 mb-6 border-b-2 border-[#14382c]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#14382c] text-white flex items-center justify-center text-3xl shadow-md">
              🌹
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#14382c]">
                {settings.companyName || 'شركة سوفت روز انترناشيونال'}
              </h1>
              <p className="text-sm font-bold text-slate-600">
                تقرير حملة توزيع الهدايا الرسمي • لصناعة الورق والبلاستيك
              </p>
            </div>
          </div>
          <div className="text-left" dir="ltr">
            <div className="text-xs font-mono font-bold text-slate-500">
              Export Date: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}
            </div>
            <div className="text-xs font-bold text-emerald-800 mt-1">
              حالة التقرير: موثق ومعتمد رسمياً
            </div>
          </div>
        </div>

        {/* Stats Summary Box */}
        <div className="grid grid-cols-4 gap-4 p-4 mb-6 rounded-2xl bg-emerald-50/70 border border-emerald-900/20 text-center">
          <div>
            <div className="text-xs text-slate-500 font-bold">إجمالي الهدايا المسلمة</div>
            <div className="text-2xl font-black text-[#14382c] font-mono mt-1">{stats.claimedCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold">نطاق الأرقام العشوائية</div>
            <div className="text-2xl font-black text-[#14382c] font-mono mt-1">[{stats.min} - {stats.max}]</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold">الأرقام المتبقية</div>
            <div className="text-2xl font-black text-emerald-700 font-mono mt-1">{stats.remainingCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold">نسبة إنجاز الحملة</div>
            <div className="text-2xl font-black text-[#14382c] font-mono mt-1">{stats.percentage}%</div>
          </div>
        </div>

        {/* Full Customers Table */}
        <table className="w-full text-right border-collapse border border-slate-300 text-sm">
          <thead>
            <tr className="bg-[#14382c] text-white">
              <th className="p-3 border border-[#14382c] text-center w-12">#</th>
              <th className="p-3 border border-[#14382c]">اسم العميل</th>
              <th className="p-3 border border-[#14382c]">رقم الهاتف</th>
              <th className="p-3 border border-[#14382c] text-center">رقم الهدية المميز</th>
              <th className="p-3 border border-[#14382c]">تاريخ وساعة المسح</th>
              <th className="p-3 border border-[#14382c]">رمز الجلسة (QR Session)</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => (
              <tr key={c.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="p-3 border border-slate-300 text-center font-mono font-bold text-slate-600">
                  {i + 1}
                </td>
                <td className="p-3 border border-slate-300 font-bold text-slate-900">
                  {c.customerName}
                </td>
                <td className="p-3 border border-slate-300 font-mono text-slate-700 text-left" dir="ltr">
                  {c.phoneNumber}
                </td>
                <td className="p-3 border border-slate-300 text-center font-mono font-black text-emerald-800 text-base">
                  #{c.giftNumber}
                </td>
                <td className="p-3 border border-slate-300 text-slate-700">
                  {c.formattedDate || new Date(c.timestamp).toLocaleString('ar-EG')}
                </td>
                <td className="p-3 border border-slate-300 font-mono text-xs text-slate-500" dir="ltr">
                  {c.sessionId || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-slate-300 flex items-center justify-between text-xs text-slate-500">
          <div>تم استخراج هذا التقرير تلقائياً من نظام توزيع هدايا سوفت روز انترناشيونال</div>
          <div dir="ltr">Soft Rose International • Confidential Report</div>
        </div>
      </div>
    </div>
  );
};
