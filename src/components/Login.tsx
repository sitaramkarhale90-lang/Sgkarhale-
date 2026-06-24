import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Mail, Lock, User, Phone, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const Login: React.FC = () => {
  const { loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  // Mobile OTP simulation states
  const [isMobileMode, setIsMobileMode] = useState(false);
  const [mobileNum, setMobileNum] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        if (!name.trim()) throw new Error("Name is required");
        await registerWithEmail(email, password, name);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes("operation-not-allowed")) {
        setError("ईमेल/पासवर्ड प्रमाणीकरण आपके Firebase Console में सक्षम नहीं है। इसे सक्षम करने के लिए: Firebase Console -> Authentication -> Sign-in method में जाएं।");
      } else {
        setError(err.message || "प्रमाणीकरण विफल रहा। अपने विवरण की जाँच करें।");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes("operation-not-allowed")) {
        setError("Google लॉगिन आपके Firebase Console में सक्षम नहीं है। इसे सक्षम करने के लिए: Firebase Console -> Authentication -> Sign-in method में जाएं।");
      } else {
        setError(err.message || "Google लॉगिन विफल रहा।");
      }
    } finally {
      setLoading(false);
    }
  };

  // Simulate OTP send/verify
  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (mobileNum.length < 10) {
      setError("कृपया सही मोबाइल नंबर दर्ज करें (कम से कम 10 अंक)");
      return;
    }
    setError('');
    setLoading(true);
    
    setTimeout(() => {
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setSimulatedOtp(mockOtp);
      setOtpSent(true);
      setLoading(false);
      setSuccessMsg(`Simulated OTP Sent! Your code is: ${mockOtp}`);
    }, 1200);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode !== simulatedOtp) {
      setError("गलत OTP! कृपया फिर से प्रयास करें।");
      return;
    }
    setError('');
    setLoading(true);
    
    try {
      // Create or login user using a simulated deterministic email based on mobile number
      const mockEmail = `mobile_${mobileNum}@apnasocial.com`;
      const mockPassword = `mobile_${mobileNum}_pwd`;
      
      try {
        await loginWithEmail(mockEmail, mockPassword);
      } catch (loginErr: any) {
        // If user doesn't exist, register them
        await registerWithEmail(mockEmail, mockPassword, `User ${mobileNum.slice(-4)}`);
      }
    } catch (err: any) {
      setError("मोबाइल लॉगिन विफल रहा: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Decorative Rings */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl"></div>

      {/* Main card */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-slate-800/80 backdrop-blur-md rounded-2xl p-8 border border-slate-700/60 shadow-2xl relative z-10"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-violet-600 to-cyan-500 rounded-2xl mb-4 shadow-lg shadow-violet-500/20">
            <Sparkles className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            अपना सोशल नेटवर्क
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {isMobileMode 
              ? "OTP लॉगिन के साथ तुरंत जुड़ें" 
              : isRegister 
                ? "नया अकाउंट बनाएं और दोस्तों से जुड़ें" 
                : "अपने दोस्तों के साथ फिर से जुड़ें"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/15 border border-red-500/35 rounded-xl text-red-200 text-sm flex flex-col gap-2 shadow-inner">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
              <span className="font-semibold text-red-300">प्रमाणीकरण त्रुटि (Auth Info)</span>
            </div>
            <p className="text-xs text-red-300/90 leading-relaxed pl-7">
              {error}
            </p>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm font-semibold flex items-start gap-2">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {isMobileMode ? (
          /* Mobile OTP Login Form */
          <div>
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">मोबाइल नंबर (Mobile Number)</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input 
                      type="tel" 
                      placeholder="9876543210" 
                      value={mobileNum}
                      onChange={(e) => setMobileNum(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-lg tracking-wider"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-cyan-500/10 cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'भेज रहा है...' : 'OTP भेजें (Send OTP)'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">OTP कोड दर्ज करें</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input 
                      type="text" 
                      maxLength={6}
                      placeholder="XXXXXX" 
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-center text-2xl font-bold tracking-widest"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
                >
                  {loading ? 'सत्यापित कर रहा है...' : 'लॉगिन करें (Verify & Login)'}
                </button>
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="w-full text-slate-400 hover:text-white text-sm mt-2 transition-colors cursor-pointer text-center"
                >
                  नंबर बदलें (Change Mobile Number)
                </button>
              </form>
            )}
            
            <div className="relative flex py-6 items-center">
              <div className="flex-grow border-t border-slate-700/60"></div>
              <span className="flex-shrink mx-4 text-slate-500 text-xs uppercase tracking-wider">या फिर</span>
              <div className="flex-grow border-t border-slate-700/60"></div>
            </div>

            <button
              onClick={() => { setIsMobileMode(false); setError(''); }}
              className="w-full bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600 text-slate-200 font-semibold py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Mail className="w-5 h-5 text-violet-400" />
              ईमेल द्वारा लॉगिन करें
            </button>
          </div>
        ) : (
          /* Email Auth Form */
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">पूरा नाम (Full Name)</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="आपका नाम दर्ज करें" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    required={isRegister}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">ईमेल (Email Address)</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">पासवर्ड (Password)</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-700 hover:to-cyan-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-violet-500/10 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'कृपया प्रतीक्षा करें...' : isRegister ? 'अकाउंट बनाएं' : 'लॉगिन करें'}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(''); }}
                className="text-cyan-400 hover:text-cyan-300 text-sm transition-colors cursor-pointer"
              >
                {isRegister ? 'पहले से अकाउंट है? लॉगिन करें' : 'नया अकाउंट बनाना चाहते हैं? रजिस्टर करें'}
              </button>
            </div>

            <div className="relative flex py-4 items-center">
              <div className="flex-grow border-t border-slate-700/60"></div>
              <span className="flex-shrink mx-4 text-slate-500 text-xs uppercase tracking-wider">या फिर</span>
              <div className="flex-grow border-t border-slate-700/60"></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600 text-slate-200 font-semibold py-3 rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.111 4.114-3.414 0-6.19-2.776-6.19-6.19 0-3.414 2.776-6.19 6.19-6.19 1.483 0 2.844.53 3.917 1.398l3.107-3.107C18.293 1.848 15.394 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c5.816 0 10.841-4.184 10.841-11.24 0-.644-.064-1.288-.176-1.955H12.24z"/>
                </svg>
                Google लॉगिन
              </button>

              <button
                type="button"
                onClick={() => { setIsMobileMode(true); setError(''); }}
                className="bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600 text-slate-200 font-semibold py-3 rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4 text-cyan-400" />
                मोबाइल लॉगिन
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
