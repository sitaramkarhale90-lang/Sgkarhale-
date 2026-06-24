import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import { Login } from './components/Login';
import { Feed } from './components/Feed';
import { Reels } from './components/Reels';
import { Messenger } from './components/Messenger';
import { GroupsPages } from './components/GroupsPages';
import { LiveStreamArea } from './components/LiveStream';
import { Profile } from './components/Profile';
import { Notifications } from './components/Notifications';
import { WalletPayments } from './components/WalletPayments';
import { db } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  Home, 
  Video, 
  MessageSquare, 
  Users, 
  Radio, 
  Bell, 
  User, 
  LogOut, 
  Sparkles,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function Dashboard() {
  const { profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'feed' | 'reels' | 'chats' | 'communities' | 'live' | 'notifications' | 'profile' | 'wallet'>('feed');
  const [unreadCount, setUnreadCount] = useState(0);

  // Monitor unread notifications
  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', profile.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [profile]);

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'feed':
        return <Feed />;
      case 'reels':
        return <Reels />;
      case 'chats':
        return <Messenger />;
      case 'communities':
        return <GroupsPages />;
      case 'live':
        return <LiveStreamArea />;
      case 'notifications':
        return <Notifications />;
      case 'profile':
        return <Profile />;
      case 'wallet':
        return <WalletPayments />;
      default:
        return <Feed />;
    }
  };

  const navItems = [
    { id: 'feed', label: 'होम', icon: Home },
    { id: 'reels', label: 'रील्स', icon: Video },
    { id: 'chats', label: 'मैसेंजर', icon: MessageSquare },
    { id: 'communities', label: 'कम्युनिटी', icon: Users },
    { id: 'live', label: 'लाइव स्ट्रीमिंग', icon: Radio },
    { id: 'wallet', label: 'वॉलेट & पेमेंट', icon: Wallet },
    { id: 'notifications', label: 'सूचनाएं', icon: Bell, badge: unreadCount },
    { id: 'profile', label: 'प्रोफाइल', icon: User }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Header Navigation */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40 px-4 py-3 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-tr from-violet-600 to-cyan-500 rounded-xl">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <span className="text-lg font-black bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
              अपना सोशल नेटवर्क
            </span>
          </div>

          <div className="flex items-center gap-4">
            {profile && (
              <>
                {/* Coins wallet indicator */}
                <button 
                  onClick={() => setActiveTab('wallet')}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-slate-300">⭐ {profile.walletBalance || 0}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setActiveTab('profile')}
                    className="flex items-center gap-2 text-left group"
                  >
                    <img 
                      src={profile.photoURL} 
                      alt="" 
                      className="w-8 h-8 rounded-full border border-slate-700 group-hover:border-cyan-400 transition-colors object-cover" 
                    />
                    <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors hidden sm:inline">
                      {profile.displayName}
                    </span>
                  </button>

                  <button
                    onClick={logout}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-6xl w-full mx-auto flex flex-col md:flex-row gap-6 p-4">
        
        {/* Left Side Navigation (Desktop only) */}
        <aside className="hidden md:block w-64 shrink-0 space-y-2 sticky top-20 h-fit">
          <div className="p-2 bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${isActive ? 'bg-gradient-to-r from-violet-600/20 to-cyan-500/10 border border-violet-800/40 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[9px] rounded-full">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Core Tab View Area */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              {renderActiveTabContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Bottom Sticky Navigation (Mobile/Tablet only) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around z-40 shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className="flex flex-col items-center gap-1 p-1.5 relative cursor-pointer"
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span className={`text-[9px] font-medium ${isActive ? 'text-cyan-300 font-bold' : 'text-slate-500'}`}>
                {item.label}
              </span>
              {item.badge && item.badge > 0 ? (
                <span className="absolute top-1 right-2 w-4 h-4 bg-rose-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-slate-900">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function MainApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center gap-3">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 tracking-wider">लोड हो रहा है, कृपया प्रतीक्षा करें...</p>
      </div>
    );
  }

  return user ? <Dashboard /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
