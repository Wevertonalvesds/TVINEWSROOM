import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { auth, updatePassword, EmailAuthProvider, reauthenticateWithCredential, db, getDoc, doc, setDoc } from '../firebase';

const DEFAULT_MEMBERS = [
  { email: 'kaikycardososp@gmail.com', name: 'Kaiky Almeida' },
  { email: 'moonlighterstore@gmail.com', name: 'Ana Luiza Lima' },
  { email: 'franca.rodrigo1998@gmail.com', name: 'Rodrigo Rangel' },
  { email: 'samcompop@outlook.com.br', name: 'Samuel Xavier' },
  { email: 'kauapereira.jrn@gmail.com', name: 'Kauã Pereira' },
  { email: 'miguelramalhocastilho759@gmail.com', name: 'Miguel Ramalho' },
  { email: 'weverton.alvesdevetor@gmail.com', name: 'Weverton Souza' },
];

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: { uid: string; email: string } | null;
}

export default function ChangePasswordModal({ isOpen, onClose, currentUser }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!currentPassword) {
      setError('Por favor, informe a senha atual.');
      return;
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve conter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      const userEmail = user?.email || currentUser?.email;

      if (!userEmail) {
        throw new Error('Nenhum usuário autenticado encontrado. Faça login para alterar a senha.');
      }

      const normalizedEmail = userEmail.toLowerCase().trim();

      // 1. Verify current password
      let isVerified = false;
      
      // Check custom credentials collection in Firestore first
      const credentialRef = doc(db, 'credenciais', normalizedEmail);
      const credentialSnap = await getDoc(credentialRef);
      
      if (credentialSnap.exists()) {
        const savedPassword = credentialSnap.data()?.password;
        if (savedPassword === currentPassword) {
          isVerified = true;
        } else {
          throw { code: 'auth/wrong-password', message: 'A senha atual digitada está incorreta.' };
        }
      } else {
        // No custom credentials document yet. Verify default predefined password
        const isPredefined = DEFAULT_MEMBERS.some(m => m.email.toLowerCase() === normalizedEmail);
        const isAdmin = normalizedEmail === 'redetviespelho@redetvi.com' || normalizedEmail === 'rededetviespelho@redetvi.com';
        
        const expectedDefaultPassword = isAdmin ? 'espelho123' : 'tvi2026';
        if (currentPassword === expectedDefaultPassword) {
          isVerified = true;
        } else {
          throw { code: 'auth/wrong-password', message: 'A senha atual digitada está incorreta.' };
        }
      }

      if (!isVerified) {
        throw { code: 'auth/wrong-password', message: 'A senha atual digitada está incorreta.' };
      }

      // 2. Try to update in Firebase Auth if a real user exists
      if (user) {
        const isGoogleUser = user.providerData.some(p => p.providerId === 'google.com');
        if (!isGoogleUser) {
          try {
            const credential = EmailAuthProvider.credential(userEmail, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
          } catch (fbErr: any) {
            console.warn("Failed to update password in Firebase Auth:", fbErr);
            // If it's a critical auth error, we can still proceed with custom credentials update
          }
        }
      }

      // 3. Always save/update in Firestore 'credenciais' collection for guaranteed persistence and future bypass logins
      await setDoc(doc(db, 'credenciais', normalizedEmail), {
        email: userEmail,
        password: newPassword,
        updatedAt: new Date().toISOString()
      });

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2500);
    } catch (err: any) {
      console.error('Error changing password:', err);
      const errorCode = err.code || '';
      
      if (err.message && !errorCode) {
        setError(err.message);
      } else {
        switch (errorCode) {
          case 'google-auth-restriction':
            setError(err.message);
            break;
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            setError('A senha atual digitada está incorreta. Verifique e tente novamente.');
            break;
          case 'auth/requires-recent-login':
            setError('Por segurança, esta operação exige login recente. Recarregue a página ou faça login novamente.');
            break;
          case 'auth/weak-password':
            setError('A nova senha é considerada muito fraca. Por favor, digite uma senha mais forte, com no mínimo 6 caracteres.');
            break;
          case 'auth/user-disabled':
            setError('Este usuário foi desativado.');
            break;
          default:
            setError(err.message || 'Ocorreu um erro ao atualizar a senha. Por favor, tente novamente.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm no-print">
        {/* Backdrop clickable closure */}
        <motion.div 
          className="absolute inset-0" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        <motion.div
          className="w-full max-w-md bg-[#18181b] border border-zinc-850 rounded-2xl p-6 shadow-2xl relative z-10 overflow-hidden text-zinc-100"
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* Accent decoration stripe */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 to-amber-600" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-lg font-bold font-display uppercase tracking-wider text-zinc-100 mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500" />
            <span>Alterar Senha Operacional</span>
          </h2>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex gap-2.5 items-start text-left mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 stroke-[2]" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex gap-2.5 items-start text-left mb-4">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 stroke-[2]" />
              <span>Sua senha foi alterada com sucesso! Fechando a janela...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                Senha Atual
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                  className="w-full bg-[#111113] border border-zinc-800 focus:border-amber-500/60 rounded-xl py-2.5 pl-11 pr-11 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all font-sans"
                  required
                />
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                Nova Senha (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha operacional"
                  className="w-full bg-[#111113] border border-zinc-800 focus:border-amber-500/60 rounded-xl py-2.5 pl-11 pr-11 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all font-sans"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme a nova senha operacional"
                  className="w-full bg-[#111113] border border-zinc-800 focus:border-amber-500/60 rounded-xl py-2.5 pl-11 pr-4 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all font-sans"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Confirmar Alteração</span>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
