import React, { useState } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, db, getDoc, doc, setDoc } from '../firebase';
import { Lock, Mail, Tv, UserPlus, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { DEFAULT_MEMBERS, isUserAdmin } from '../types';
// @ts-ignore
import logoCor from '../../assets/.aistudio/logo cor.png';

interface AuthScreenProps {
  onAuthSuccess: (user: { uid: string; email: string }) => void;
  onBypass?: () => void;
}

const DEFAULT_PASSWORD = 'tvi2026';

const normalizeStr = (str: string) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const findMemberByInput = (input: string) => {
  const cleanInput = input.trim().toLowerCase();
  if (cleanInput.includes('@')) {
    return DEFAULT_MEMBERS.find(m => m.email.toLowerCase() === cleanInput);
  }
  const normalizedInput = normalizeStr(input);
  if (!normalizedInput) return null;
  
  return DEFAULT_MEMBERS.find(m => {
    const normalizedName = normalizeStr(m.name);
    
    // Check if name matches (contains or equals)
    const matchesName = (
      normalizedName === normalizedInput ||
      normalizedName.includes(normalizedInput) ||
      normalizedInput.includes(normalizedName)
    );
    if (matchesName) return true;

    // Check if the input matches the email prefix (e.g. "weverton.alvesdevetor" before "@")
    const emailParts = m.email.toLowerCase().split('@');
    if (emailParts.length > 0) {
      const emailPrefix = emailParts[0];
      const normalizedEmailPrefix = normalizeStr(emailPrefix);
      if (
        normalizedEmailPrefix === normalizedInput ||
        normalizedEmailPrefix.includes(normalizedInput) ||
        normalizedInput.includes(normalizedEmailPrefix)
      ) {
        return true;
      }
    }

    return false;
  });
};

export default function AuthScreen({ onAuthSuccess, onBypass }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgCorError, setImgCorError] = useState(false);

  const translateError = (code: string) => {
    switch (code) {
      case 'auth/invalid-email':
        return 'E-mail ou Usuário inválido. Verifique o formato.';
      case 'auth/user-disabled':
        return 'Este usuário foi desativado.';
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
        return 'Usuário não encontrado ou senha incorreta. Se este for seu primeiro acesso, use seu e-mail/usuário cadastrado e a senha padrão "tvi2026".';
      case 'auth/wrong-password':
        return 'Senha incorreta. Se esta for sua primeira vez, use a senha padrão "tvi2026" ou solicite redefinição.';
      case 'auth/email-already-in-use':
        return 'Este endereço de e-mail ou usuário já está cadastrado.';
      case 'auth/weak-password':
        return 'A senha deve conter no mínimo 6 caracteres.';
      case 'auth/missing-password':
        return 'Por favor, insira uma senha.';
      case 'auth/operation-not-allowed':
        return 'O login de E-mail/Senha precisa ser habilitado no Firebase Console. Acesse o Console Firebase > Authentication > Sign-in method e ative "E-mail/senha".';
      default:
        console.error("Firebase auth error code:", code);
        return `Erro de autenticação (${code || 'desconhecido'}). Se preferir, use as credenciais padrão de acesso ou sua senha padrão.`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const inputLogin = email.trim();
    const inputPassword = password;

    // Basic Validation
    if (!inputLogin || !inputPassword) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (isSignUp) {
      if (inputPassword !== confirmPassword) {
        setError('As senhas digitadas não coincidem.');
        return;
      }
      if (inputPassword.length < 6) {
        setError('A senha deve conter pelo menos 6 caracteres.');
        return;
      }
    }

    // Match input name or email against predefined members
    const matchedMember = findMemberByInput(inputLogin);
    let targetEmail = matchedMember ? matchedMember.email : inputLogin;
    const isPredefinedMember = !!matchedMember;

    if (!targetEmail.includes('@')) {
      targetEmail = `${targetEmail.toLowerCase()}@redetvi.com`;
    }

    const cleanInput = inputLogin.toLowerCase().trim();
    const isDefaultAdmin = isUserAdmin(targetEmail) && inputPassword === 'espelho123';

    const normalizedEmail = targetEmail.toLowerCase().trim();

    setLoading(true);
    try {
      let loggedUser: any = null;
      if (isSignUp) {
        try {
          const credential = await createUserWithEmailAndPassword(auth, targetEmail, inputPassword);
          loggedUser = credential.user;
        } catch (signUpErr) {
          console.warn("Could not sign up via Firebase Auth, using custom credentials flow:", signUpErr);
          // Fallback to local bypass model
          loggedUser = {
            uid: `member-${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '-')}`,
            email: targetEmail
          };
        }
        
        // Save to custom credentials in Firestore for robustness
        try {
          await setDoc(doc(db, 'credenciais', normalizedEmail), {
            email: targetEmail,
            password: inputPassword,
            updatedAt: new Date().toISOString()
          });
        } catch (dbErr) {
          console.error("Failed to write to custom credentials collection:", dbErr);
        }
      } else {
        // LogIn Flow
        let isCustomMatch = false;
        
        // 1. Try checking custom credentials in Firestore first
        try {
          const credentialRef = doc(db, 'credenciais', normalizedEmail);
          const credentialSnap = await getDoc(credentialRef);
          if (credentialSnap.exists()) {
            const savedPassword = credentialSnap.data()?.password;
            if (savedPassword === inputPassword) {
              isCustomMatch = true;
              loggedUser = {
                uid: `member-${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '-')}`,
                email: targetEmail
              };
              
              // Try standard sign-in in background to sync state if possible
              try {
                await signInWithEmailAndPassword(auth, targetEmail, inputPassword);
              } catch (bgErr) {
                console.log("Background Firebase Auth sign-in failed (acceptable if provider disabled):", bgErr);
              }
            } else {
              // Custom credential exists but password does not match
              throw { code: 'auth/wrong-password', message: 'Senha incorreta.' };
            }
          }
        } catch (customErr: any) {
          if (customErr?.code === 'auth/wrong-password') {
            throw customErr;
          }
          console.warn("Firestore custom credential fetch skipped or failed:", customErr);
        }

        // 2. If no custom match, try standard Firebase Auth
        if (!isCustomMatch) {
          try {
            const credential = await signInWithEmailAndPassword(auth, targetEmail, inputPassword);
            loggedUser = credential.user;
          } catch (signInErr: any) {
            // If sign in fails but it's a predefined member, register them automatically on the fly
            const isPredefinedAuto = isPredefinedMember && inputPassword.length >= 6;
            if (isPredefinedAuto) {
              console.log("Predefined member first-time login. Creating account automatically.");
              try {
                const credential = await createUserWithEmailAndPassword(auth, targetEmail, inputPassword);
                loggedUser = credential.user;
              } catch (createErr) {
                console.warn("Could not create Firebase account, using fallback bypass:", createErr);
                loggedUser = {
                  uid: `member-${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '-')}`,
                  email: targetEmail
                };
              }
              
              // Also create custom credential entry in Firestore so it persists
              try {
                await setDoc(doc(db, 'credenciais', normalizedEmail), {
                  email: targetEmail,
                  password: inputPassword,
                  updatedAt: new Date().toISOString()
                });
              } catch (dbErr) {
                console.error("Failed to sync custom credential:", dbErr);
              }
            } else {
              throw signInErr;
            }
          }
        }
      }
      
      if (loggedUser) {
        onAuthSuccess({
          uid: loggedUser.uid,
          email: loggedUser.email || targetEmail
        });
      }
    } catch (err: any) {
      console.warn('Auth credential notice (handled):', err);
      
      // Check if there is an active custom password in Firestore for this predefined user
      let hasCustomPasswordSet = false;
      try {
        const credentialRef = doc(db, 'credenciais', normalizedEmail);
        const credentialSnap = await getDoc(credentialRef);
        if (credentialSnap.exists()) {
          hasCustomPasswordSet = true;
          const savedPassword = credentialSnap.data()?.password;
          if (savedPassword === inputPassword) {
            console.log("Predefined member bypassed successfully via Firestore credentials match.");
            onAuthSuccess({
              uid: `member-${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '-')}`,
              email: targetEmail
            });
            return;
          } else {
            setError('Senha operacional incorreta.');
            return;
          }
        }
      } catch (customDbErr) {
        console.error("Error checking custom password during fallback:", customDbErr);
      }

      // Fallback for predefined members on their first login (only if they don't have a custom password set yet)
      if (isPredefinedMember && !hasCustomPasswordSet) {
        console.log("Entering predefined member via first-login bypass.");
        
        // Register this password as their custom credential in Firestore on the fly!
        try {
          await setDoc(doc(db, 'credenciais', normalizedEmail), {
            email: targetEmail,
            password: inputPassword,
            updatedAt: new Date().toISOString()
          });
        } catch (dbErr) {
          console.error("Failed to sync custom credential on fallback bypass:", dbErr);
        }

        onAuthSuccess({
          uid: `member-${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '-')}`,
          email: targetEmail
        });
        return;
      }

      // If they are trying the default master credentials and we hit any security/config/offline block,
      // bypass the error so they have a fully functional local/syncing admin account immediately!
      if (isDefaultAdmin) {
        console.log("Entering via local standard override profile under credentials.");
        onAuthSuccess({
          uid: 'espelho-rede-tvi-master',
          email: targetEmail
        });
      } else {
        setError(translateError(err.code || '') || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full filter blur-3xl pointer-events-none animate-pulse duration-[12000ms]" />

      <div className="max-w-md w-full relative z-10 space-y-8">
        
        {/* TVI Station Brand Logo Header */}
        <div className="text-center space-y-3">
          {!imgCorError ? (
            <img 
              src={logoCor}
              alt="REDE TVI" 
              className="mx-auto max-h-[160px] w-auto transition-all duration-300 hover:scale-105 filter drop-shadow-[0_0_20px_rgba(255,255,255,0.08)]"
              referrerPolicy="no-referrer"
              onError={() => setImgCorError(true)}
            />
          ) : (
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-zinc-950 shadow-2xl shadow-amber-500/30 border border-amber-400/25">
              <Tv className="w-10 h-10 stroke-[2.3]" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-display font-extrabold tracking-tight text-zinc-50 uppercase">
              TVI NEWSROOM
            </h1>
          </div>
        </div>

        {/* Auth Box Container */}
        <div className="bg-[#18181b] border border-zinc-850/80 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          {/* Accent decoration stripe */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-yellow-500 to-indigo-600" />

          <h2 className="text-lg font-semibold text-zinc-100 text-left mb-6 font-display">
            {isSignUp ? 'Criar Nova Credencial de Editor' : 'Acesse o Painel de Produção'}
          </h2>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex gap-2.5 items-start text-left mb-5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 stroke-[2]" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                Nome de Editor ou E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ex: Usuário ou seu e-mail"
                  className="w-full bg-[#111113] border border-zinc-800 focus:border-amber-500/60 rounded-xl py-2.5 pl-11 pr-4 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all font-sans"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                Senha Operacional
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            {/* Confirm Password (Registration context only) */}
            {isSignUp && (
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#111113] border border-zinc-800 focus:border-amber-500/60 rounded-xl py-2.5 pl-11 pr-4 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all font-sans"
                    required
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {isSignUp ? <UserPlus className="w-4 h-4 stroke-[2.3]" /> : <LogIn className="w-4 h-4 stroke-[2.3]" />}
                  <span>{isSignUp ? 'Cadastrar Credencial' : 'Acessar o Painel'}</span>
                </>
              )}
            </button>
          </form>



        </div>

        {/* Humble Station Footnote */}
        <p className="text-center font-mono text-[9px] text-zinc-650 uppercase tracking-widest">
          Rede TVI • Sistema de Gerenciamento Editorial Dedicado • 2026
        </p>

      </div>
    </div>
  );
}
