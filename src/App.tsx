import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CustomerGiftView } from './components/CustomerGiftView';
import { AdminDashboard } from './components/AdminDashboard';
import { MainHomeQrView } from './components/MainHomeQrView';
import { SettingsModal } from './components/SettingsModal';
import { AdminPasscodeModal } from './components/AdminPasscodeModal';
import { QRCodeTesterModal } from './components/QRCodeTesterModal';
import { CodeDocumentationModal } from './components/CodeDocumentationModal';
import { CampaignSettings } from './types';
import { DEFAULT_SETTINGS, getCampaignSettings } from './services/firebase';

export default function App() {
  const [settings, setSettings] = useState<CampaignSettings>(DEFAULT_SETTINGS);
  const [currentSessionId, setCurrentSessionId] = useState<string>('sr_booth_gift_1');
  const [activeView, setActiveView] = useState<'home_qr' | 'customer' | 'admin'>('home_qr');
  const [isCustomerMode, setIsCustomerMode] = useState<boolean>(false);

  // Modal controls
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isQrSimulatorOpen, setIsQrSimulatorOpen] = useState<boolean>(false);
  const [isCodeDocsOpen, setIsCodeDocsOpen] = useState<boolean>(false);

  // Load saved campaign settings
  useEffect(() => {
    getCampaignSettings().then((s) => setSettings(s));
  }, []);

  // Parse URL for session or view parameters (e.g. ?session=sr_101 or ?view=admin)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    const viewParam = params.get('view');

    if (sessionParam) {
      setCurrentSessionId(sessionParam);
      // When a customer opens via scanning the QR code, immediately show only the customer view
      setActiveView('customer');
      setIsCustomerMode(true);
    } else {
      setActiveView('home_qr');
      setIsCustomerMode(false);
    }

    if (viewParam === 'admin') {
      setIsPasscodeModalOpen(true);
    }
  }, []);

  const handleAdminAuthSuccess = () => {
    setIsAdminLoggedIn(true);
    setIsPasscodeModalOpen(false);
    setActiveView('admin');
  };

  const handleOpenAdmin = () => {
    if (isAdminLoggedIn) {
      setActiveView(activeView === 'admin' ? 'home_qr' : 'admin');
    } else {
      setIsPasscodeModalOpen(true);
    }
  };

  const handleLogoutAdmin = () => {
    setIsAdminLoggedIn(false);
    setActiveView('home_qr');
  };

  const handleSessionChange = (newSessionId: string) => {
    setCurrentSessionId(newSessionId);
    setActiveView('customer');
    // Update URL query string without reloading
    const newUrl = `${window.location.pathname}?session=${encodeURIComponent(newSessionId)}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  // Determine if tabs and navigation should be displayed
  // Customer never sees the tabs; Main screen only shows tabs after admin logs in with password
  const showViewSwitcherTabs = isAdminLoggedIn;

  return (
    <div
      className="min-h-screen flex flex-col font-sans selection:bg-rose-200 selection:text-rose-900 relative overflow-x-hidden"
      style={{
        background: 'radial-gradient(circle at 10% 15%, #e8f9f3 0%, #fdf2f4 45%, #f4fbf8 100%)',
      }}
    >
      {/* Soft Rose Background Ambient Glow Orbs */}
      <div className="fixed top-[-100px] right-[-100px] w-96 h-96 bg-emerald-300/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-100px] left-[-100px] w-96 h-96 bg-rose-300/20 rounded-full blur-3xl pointer-events-none" />

      {/* Persistent Header */}
      <Header
        settings={settings}
        onOpenAdminAuth={handleOpenAdmin}
        isAdminLoggedIn={isAdminLoggedIn}
        onLogoutAdmin={handleLogoutAdmin}
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
        onOpenQrSimulator={() => setIsQrSimulatorOpen(true)}
        isCustomerMode={isCustomerMode && !isAdminLoggedIn}
      />

      {/* View Switcher Tabs - Only visible after entering admin passcode */}
      {showViewSwitcherTabs && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/70 backdrop-blur-xs border border-emerald-900/10 shadow-2xs text-xs font-bold">
            <button
              onClick={() => setActiveView('home_qr')}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeView === 'home_qr'
                  ? 'bg-[#14382c] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              شاشة الكود (Scan Me)
            </button>

            <button
              onClick={() => setActiveView('customer')}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeView === 'customer'
                  ? 'bg-[#14382c] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              صفحة العميل (هاتف العميل)
            </button>

            <button
              onClick={() => setActiveView('admin')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeView === 'admin'
                  ? 'bg-[#14382c] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <span>لوحة الإدارة (Admin)</span>
            </button>
          </div>

          {/* Current Session Tag */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>الجلسة الحالية:</span>
            <span className="font-mono font-bold text-emerald-800 bg-emerald-100/60 px-2 py-0.5 rounded-lg border border-emerald-200">
              {currentSessionId}
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeView === 'home_qr' ? (
          <MainHomeQrView
            currentSessionId={currentSessionId}
            settings={settings}
            isAdminLoggedIn={isAdminLoggedIn}
            onOpenCustomerViewOnDevice={() => setActiveView('customer')}
            onGenerateNewSession={(newSessionId) => {
              setCurrentSessionId(newSessionId);
              const newUrl = `${window.location.pathname}?session=${encodeURIComponent(newSessionId)}`;
              window.history.pushState({ path: newUrl }, '', newUrl);
            }}
          />
        ) : activeView === 'customer' ? (
          <CustomerGiftView
            key={currentSessionId}
            sessionId={currentSessionId}
            settings={settings}
            onRefreshSession={() => {
              setCurrentSessionId((prev) => prev);
            }}
            onGoToSimulator={isAdminLoggedIn ? () => setIsQrSimulatorOpen(true) : undefined}
          />
        ) : (
          <AdminDashboard
            settings={settings}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onOpenQrSimulator={() => setIsQrSimulatorOpen(true)}
            onOpenCodeDocs={() => setIsCodeDocsOpen(true)}
            onLogout={handleLogoutAdmin}
          />
        )}
      </main>

      {/* Footer Branding */}
      <footer className="w-full border-t border-emerald-950/10 py-6 text-center text-xs text-slate-500 bg-white/50 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            جميع الحقوق محفوظة © {new Date().getFullYear()} شركة{' '}
            <span className="font-bold text-[#14382c]">{settings.companyName}</span> لصناعة الورق والبلاستيك.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>نظام توزيع الهدايا الآمن</span>
            <span>•</span>
            <button
              onClick={() => setIsCodeDocsOpen(true)}
              className="text-emerald-700 hover:text-emerald-800 font-semibold underline"
            >
              عرض تعليمات وكود المشروع
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AdminPasscodeModal
        isOpen={isPasscodeModalOpen}
        onClose={() => setIsPasscodeModalOpen(false)}
        onSuccess={handleAdminAuthSuccess}
        correctPasscode={settings.adminPasscode || '0000'}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentSettings={settings}
        onSettingsUpdated={(newSettings) => setSettings(newSettings)}
      />

      <QRCodeTesterModal
        isOpen={isQrSimulatorOpen}
        onClose={() => setIsQrSimulatorOpen(false)}
        currentSessionId={currentSessionId}
        onSelectSession={handleSessionChange}
      />

      <CodeDocumentationModal
        isOpen={isCodeDocsOpen}
        onClose={() => setIsCodeDocsOpen(false)}
      />
    </div>
  );
}
