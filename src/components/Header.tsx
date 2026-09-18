import React, { useState, useEffect } from 'react';
import { Settings, Sparkles, Clock, ShieldCheck, QrCode } from 'lucide-react';
import { CampaignSettings } from '../types';

interface HeaderProps {
  settings: CampaignSettings;
  onOpenAdminAuth: () => void;
  isAdminLoggedIn: boolean;
  onLogoutAdmin?: () => void;
  activeView: 'home_qr' | 'customer' | 'admin';
  onNavigate: (view: 'home_qr' | 'customer' | 'admin') => void;
  onOpenQrSimulator?: () => void;
  isCustomerMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onOpenAdminAuth,
  isAdminLoggedIn,
  onLogoutAdmin,
  activeView,
  onNavigate,
  onOpenQrSimulator,
  isCustomerMode = false,
}) => {
  const [timeState, setTimeState] = useState({
    timeStr: '',
    dateStr: '',
  });

  // Live real-time clock updating every 1 second (12-hour format AM/PM & Date)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      
      // 12-hour format with AM/PM
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'م' : 'ص'; // Arabic ص/م for AM/PM
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 becomes 12
      const timeStr = `${hours}:${minutes}:${seconds} ${ampm}`;

      // Arabic localized date
      const dateStr = now.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      setTimeState({ timeStr, dateStr });
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 border-b border-emerald-950/10 shadow-xs transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Left corner: Company Logo & Company Name */}
        <div className="flex items-center gap-3.5">
          <div
            className={`relative group ${!isCustomerMode ? 'cursor-pointer' : ''}`}
            onClick={() => {
              if (!isCustomerMode) onNavigate('home_qr');
            }}
          >
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.companyName}
                className="w-12 h-12 rounded-xl object-contain shadow-xs border border-emerald-900/15 bg-white p-1"
              />
            ) : (
              // Default Soft Rose Brand Logo SVG Icon
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#14382c] to-[#1f4f3e] flex items-center justify-center text-white shadow-md shadow-emerald-950/15 border border-emerald-800/30">
                <div className="relative">
                  <span className="text-xl">🌹</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-[#14382c] tracking-tight flex items-center gap-1.5">
                {settings.companyName || 'سوفت روز انترناشيونال'}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                حملة الهدايا
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">
              {settings.companyNameEn || 'Soft Rose International'} • لصناعة الورق والبلاستيك
            </p>
          </div>
        </div>

        {/* Right corner: Live real-time 12-hr clock + Quick Navigation & Admin Access */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Live Real-time Clock */}
          <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-50/90 to-rose-50/80 border border-emerald-900/10 text-[#14382c] shadow-2xs">
            <Clock className="w-4 h-4 text-[#14382c] animate-pulse shrink-0" />
            <div className="flex flex-col text-right">
              <span className="text-xs sm:text-sm font-bold tracking-wider font-mono direction-ltr">
                {timeState.timeStr || '--:--:--'}
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-600 font-medium truncate max-w-[130px] sm:max-w-none">
                {timeState.dateStr || 'جاري التحميل...'}
              </span>
            </div>
          </div>

          {/* Admin Dashboard Gear Button (In place of QR simulator) */}
          {!isCustomerMode && (
            <button
              id="admin-settings-gear-btn"
              onClick={onOpenAdminAuth}
              aria-label="لوحة تحكم المدير"
              title="لوحة تحكم المدير"
              className={`relative p-2.5 sm:p-2.5 rounded-xl transition-all duration-200 border flex items-center justify-center min-w-[40px] min-h-[40px] ${
                activeView === 'admin'
                  ? 'bg-[#14382c] text-white border-[#14382c] shadow-md shadow-emerald-950/20'
                  : 'bg-white hover:bg-rose-50/80 text-[#14382c] border-emerald-900/15 shadow-2xs hover:border-rose-300'
              }`}
            >
              <Settings className={`w-5 h-5 ${activeView === 'admin' ? 'rotate-90' : 'hover:rotate-45 transition-transform duration-300'}`} />
              {isAdminLoggedIn && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
              )}
            </button>
          )}

          {/* QR Simulator / Test Mode Button (ONLY shown when Admin is logged in with password) */}
          {!isCustomerMode && isAdminLoggedIn && onOpenQrSimulator && (
            <button
              id="qr-test-button"
              onClick={onOpenQrSimulator}
              title="محاكي مسح الرمز QR"
              className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold bg-emerald-100/80 hover:bg-emerald-200 text-[#14382c] transition-all flex items-center gap-1.5 border border-emerald-300 shadow-2xs"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden md:inline">محاكي الـ QR</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
