import React from 'react';
import { X, ShieldAlert, ShieldCheck, UserCheck, Lock, AlertOctagon, CheckCircle2 } from 'lucide-react';

interface SafetyStandardsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SafetyStandardsModal: React.FC<SafetyStandardsModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0b0d12] border border-slate-200 dark:border-white/15 rounded-2xl p-5 md:p-7 shadow-2xl text-slate-800 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center max-w-lg mx-auto mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-[10px] font-mono uppercase tracking-widest mb-2">
            <ShieldAlert className="w-3 h-3" />
            <span>Zero Tolerance Community Charter</span>
          </div>
          <h2 className="text-lg md:text-xl font-display font-semibold text-slate-900 dark:text-white">
            Absolute Protection Against Catfishing & Misconduct
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Rendez-vous operates as an invite-only sanctuary in the UAE. We reject superficial dating behaviors, predatory dynamics, and deception through strict admissions enforcement.
          </p>
        </div>

        {/* 4 Core Safeguard Columns */}
        <div className="space-y-3 mb-6">
          
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-0.5">
                Zero Tolerance for Harassment & Inappropriate Conduct
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Unsolicited explicit imagery, vulgar overtures, coercion, or disrespectful comments trigger an instant, permanent account ban. Device identifiers and phone hashes are permanently blacklisted across our UAE network.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-0.5">
                Ban on Anonymous Profiles & Pseudonyms
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Every member is identified by their authentic verified legal name, verified degree, and verified employer. Anonymity fosters disrespect; real-world reputation ensures accountability.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-0.5">
                Mandatory LinkedIn & 3D Video ID Liveness Audits
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                No police checks required, but biometric 3D facial video verification and LinkedIn executive credentials are mandatory prior to accessing member dossiers and the RDV radar map.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-0.5">
                Encrypted Proximity & Instant Ghost Mode
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Your location is never broadcast publicly. Candidates can only see proximity once mutual intention exists, with instant Ghost Mode toggle to blur or completely cloak coordinates at any moment.
              </p>
            </div>
          </div>

        </div>

        {/* Dismiss Button */}
        <div className="text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white dark:bg-[#d4af37] dark:text-slate-950 text-xs font-bold uppercase tracking-wider hover:brightness-105 transition-all cursor-pointer shadow-sm"
          >
            I Acknowledge & Support the Charter
          </button>
        </div>

      </div>
    </div>
  );
};
