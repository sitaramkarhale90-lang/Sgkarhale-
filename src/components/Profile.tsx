import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { SafeVideo } from './SafeVideo';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  orderBy, 
  addDoc 
} from 'firebase/firestore';
import { Post, TransactionHistory } from '../types';
import { 
  User, 
  Edit2, 
  Wallet, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sparkles, 
  BarChart, 
  Check, 
  Video, 
  FileText,
  BadgeAlert
} from 'lucide-react';
import { motion } from 'motion/react';

export const Profile: React.FC = () => {
  const { profile, updateProfileData } = useAuth();
  
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Edit Bio state
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newBio, setNewBio] = useState(profile?.bio || '');

  // Coin Purchase Loader
  const [purchasing, setPurchasing] = useState(false);

  // Fetch own posts
  useEffect(() => {
    if (!profile) return;

    // Fetch posts created by current user
    const postsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsList: Post[] = [];
      snapshot.forEach((doc) => {
        postsList.push({ id: doc.id, ...doc.data() } as Post);
      });
      // Sort manually because combined Firestore query index might not be configured
      postsList.sort((a, b) => b.createdAt - a.createdAt);
      setUserPosts(postsList);
      setLoadingPosts(false);
    });

    return () => unsubscribe();
  }, [profile]);

  // Fetch transaction history
  useEffect(() => {
    if (!profile) return;

    const tQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(tQuery, (snapshot) => {
      const tList: TransactionHistory[] = [];
      snapshot.forEach((doc) => {
        tList.push({ id: doc.id, ...doc.data() } as TransactionHistory);
      });
      setTransactions(tList);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleUpdateBio = async () => {
    if (!profile) return;
    try {
      await updateProfileData({ bio: newBio });
      setIsEditingBio(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBuyCoins = async (coins: number, price: number) => {
    if (!profile) return;
    setPurchasing(true);

    try {
      // 1. Update wallet balance in Firestore user profile
      const newBalance = (profile.walletBalance || 0) + coins;
      await updateProfileData({ walletBalance: newBalance });

      // 2. Add transaction history
      await addDoc(collection(db, 'transactions'), {
        userId: profile.uid,
        type: 'purchase_coins',
        amount: coins,
        description: `Purchased ${coins} Apna Coins via Sim Card/Cards`,
        createdAt: Date.now()
      });

      alert(`सफलतापूर्वक ${coins} Apna Coins खरीदे गए! ₹${price} आपके सिम कार्ड / कार्ड से डेबिट कर दिए गए हैं।`);
    } catch (err) {
      console.error(err);
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {profile && (
        <>
          {/* Cover / Profile Photo Area */}
          <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl relative">
            <div className="h-32 bg-gradient-to-tr from-violet-800 to-cyan-500 opacity-80"></div>
            
            <div className="px-6 pb-6 relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-10">
              <img 
                src={profile.photoURL} 
                alt={profile.displayName} 
                className="w-24 h-24 rounded-2xl bg-slate-900 p-1 border-4 border-slate-800 shadow-xl object-cover"
              />
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl font-black text-white flex items-center justify-center sm:justify-start gap-1.5">
                  <span>{profile.displayName}</span>
                  <span className="inline-flex items-center justify-center bg-blue-500 p-0.5 rounded-full text-[8px] text-white" title="Verified Creator">
                    ✓
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{profile.email}</p>
                
                {/* User Bio Edit */}
                <div className="mt-3 max-w-md">
                  {isEditingBio ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newBio}
                        onChange={(e) => setNewBio(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <button
                        onClick={handleUpdateBio}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-bold text-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 leading-relaxed italic flex items-center justify-center sm:justify-start gap-2">
                      <span>{profile.bio || 'बायो खाली है।'}</span>
                      <button 
                        onClick={() => { setIsEditingBio(true); setNewBio(profile.bio || ''); }}
                        className="p-1 hover:bg-slate-700 rounded text-cyan-400 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MONETIZATION SYSTEM (Apna Wallet) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Wallet Balance Display */}
            <div className="bg-gradient-to-tr from-slate-850 to-slate-800 border border-slate-700/60 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Apna Wallet</span>
                <Wallet className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
              <div className="py-4">
                <h3 className="text-3xl font-black text-white flex items-center gap-1.5">
                  <span className="text-cyan-400 font-sans">⭐</span>
                  <span>{profile.walletBalance || 0}</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-bold block mt-1">Virtual Apna Coins</span>
              </div>
              
              {/* Quick Buy simulations */}
              <div className="border-t border-slate-700/40 pt-3.5 space-y-2">
                <p className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider block">Coins रिचार्ज करें (Purchase Coins)</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleBuyCoins(100, 99)}
                    disabled={purchasing}
                    className="p-2 bg-slate-900 hover:bg-slate-950 border border-slate-800 text-[10px] rounded-xl text-slate-200 font-black cursor-pointer shadow flex flex-col items-center gap-0.5"
                  >
                    <span>100 Coins</span>
                    <span className="text-emerald-400 font-bold">₹99</span>
                  </button>
                  <button
                    onClick={() => handleBuyCoins(500, 399)}
                    disabled={purchasing}
                    className="p-2 bg-slate-900 hover:bg-slate-950 border border-slate-800 text-[10px] rounded-xl text-slate-200 font-black cursor-pointer shadow flex flex-col items-center gap-0.5"
                  >
                    <span>500 Coins</span>
                    <span className="text-emerald-400 font-bold">₹399</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Creator Revenue stats */}
            <div className="bg-gradient-to-tr from-slate-850 to-slate-800 border border-slate-700/60 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Creator Dashboard</span>
                <BarChart className="w-5 h-5 text-violet-400" />
              </div>
              
              {/* Calculate dynamic earnings */}
              {(() => {
                const receivedGifts = transactions.filter(t => t.type === 'received_gift');
                const totalEarned = receivedGifts.reduce((acc, t) => acc + t.amount, 0);
                return (
                  <div className="py-4 space-y-1">
                    <h3 className="text-3xl font-black text-white flex items-center gap-1.5">
                      <span className="text-violet-400">👑</span>
                      <span>{totalEarned} Stars</span>
                    </h3>
                    <span className="text-[10px] text-slate-500 font-bold block">Received from Fan livestream donations</span>
                  </div>
                );
              })()}

              <div className="border-t border-slate-700/40 pt-3.5">
                <p className="text-[9px] text-violet-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-violet-400 animate-pulse" />
                  <span>Monetization Level: Level 1</span>
                </p>
                <span className="text-[10px] text-slate-500 mt-1 block leading-tight">लगातार लाइव जाएं और रील्स अपलोड करके फैंस से कॉइन्स उपहार पाएं।</span>
              </div>
            </div>

            {/* Wallet Transactions list */}
            <div className="bg-slate-850 border border-slate-700/60 rounded-2xl p-4 shadow-lg flex flex-col h-56">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">लेखा-जोखा (Transactions)</span>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {transactions.length === 0 ? (
                  <p className="text-center text-slate-500 text-[10px] py-10">कोई लेन-देन नहीं है।</p>
                ) : (
                  transactions.map((t) => {
                    const isPositive = t.amount > 0;
                    return (
                      <div key={t.id} className="flex items-center justify-between p-2 bg-slate-900/30 rounded-xl">
                        <div className="flex items-center gap-1.5">
                          {isPositive ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-300 font-bold block truncate leading-tight">{t.description}</span>
                            <span className="text-[8px] text-slate-500 font-mono leading-none">{new Date(t.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <span className={`text-[11px] font-black font-mono shrink-0 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}{t.amount}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* User's Posts list wall */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-cyan-400" />
              मेरी पोस्ट्स ({userPosts.length})
            </h3>

            {loadingPosts ? (
              <div className="h-20 bg-slate-800 rounded-2xl animate-pulse"></div>
            ) : userPosts.length === 0 ? (
              <div className="text-center py-10 bg-slate-800 rounded-2xl border border-slate-700/60 text-slate-400">
                <p className="text-sm">आपने अभी तक कोई पोस्ट नहीं की है।</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {userPosts.map((post) => (
                  <div key={post.id} className="p-4 bg-slate-800 border border-slate-700/60 rounded-2xl space-y-2">
                    <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                      {/* Clean out tag identifiers for display if they contain page/group IDs */}
                      {post.content.split('#')[0]}
                    </p>
                    {post.mediaUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900 max-h-48">
                        {post.mediaType === 'video' ? (
                          <SafeVideo src={post.mediaUrl} muted className="w-full h-full object-cover max-h-48" />
                        ) : (
                          <img src={post.mediaUrl} alt="" className="w-full h-full object-cover max-h-48" />
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>Likes: {post.likes.length}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
