import React, { useState } from 'react';
import { KeyRound, X, Lock, ShieldCheck } from 'lucide-react';

interface AdminPasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPasscode: string;
  customTitle?: string;
  customSubtitle?: string;
  preventClose?: boolean;
}

export const AdminPasscodeModal: React.FC<AdminPasscodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  correctPasscode,
  customTitle,
  customSubtitle,
  preventClose = false,
}) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === correctPasscode.trim()) {
      setError(false);
      setPasscode('');
      onSuccess();
    } else {
      setError(true);
      setPasscode('');
    }
  };

  const handleKeyClick = (val: string) => {
    if (passcode.length < 6) {
      const next = passcode + val;
      setPasscode(next);
      if (next === correctPasscode.trim()) {
        setTimeout(() => {
          setPasscode('');
          setError(false);
          onSuccess();
        }, 150);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-8 border border-emerald-900/10 shadow-2xl text-center relative">
        {!preventClose && (
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 text-[#14382c] border border-emerald-900/10 flex items-center justify-center shadow-inner">
          <KeyRound className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-black text-[#14382c] mb-1">
          {customTitle || 'دخول لوحة تحكم المدير'}
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          {customSubtitle || 'أدخل رمز المرور السري للإدارة'}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="password"
              id="admin-passcode-input"
              autoFocus
              maxLength={6}
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setError(false);
              }}
              placeholder="••••"
              className={`w-full text-center tracking-[1em] text-2xl font-mono py-3.5 px-4 rounded-2xl border transition-all ${
                error
                  ? 'border-rose-300 bg-rose-50/50 text-rose-700 ring-2 ring-rose-200 animate-shake'
                  : 'border-slate-200 bg-slate-50 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100 text-[#14382c]'
              }`}
            />
          </div>

          {error && (
            <p className="text-xs font-bold text-rose-600 mb-4 animate-in fade-in">
              رمز المرور غير صحيح! حاول مرة أخرى
            </p>
          )}

          {/* Quick Keypad for Mobile or Touch */}
          <div className="grid grid-cols-3 gap-2 my-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'].map((key) => (
              <button
                type="button"
                key={key}
                onClick={() => {
                  if (key === 'C') {
                    setPasscode('');
                    setError(false);
                  } else if (key === '✓') {
                    handleSubmit({ preventDefault: () => {} } as any);
                  } else {
                    handleKeyClick(key);
                  }
                }}
                className={`py-3 rounded-xl font-mono font-bold text-base transition-all ${
                  key === '✓'
                    ? 'bg-[#14382c] text-white hover:bg-[#1b4a3a]'
                    : key === 'C'
                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                    : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 active:scale-95'
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          <button
            type="submit"
            id="admin-login-submit-btn"
            className="w-full py-3 px-4 rounded-2xl bg-[#14382c] hover:bg-[#1b4a3a] text-white font-bold text-sm shadow-md shadow-emerald-950/20 transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            تأكيد الدخول
          </button>
        </form>
      </div>
    </div>
  );
};
