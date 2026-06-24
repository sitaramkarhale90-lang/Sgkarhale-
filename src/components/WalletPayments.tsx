import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  addDoc, 
  doc, 
  writeBatch,
  updateDoc,
  increment,
  getDoc
} from 'firebase/firestore';
import { TransactionHistory, PaymentRequest, UserProfile, Reel } from '../types';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Coins, 
  Users, 
  Send, 
  PlusCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Search,
  MessageSquare,
  Sparkles,
  Info,
  Eye,
  Tv,
  CreditCard,
  TrendingUp,
  ArrowRight,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const WalletPayments: React.FC = () => {
  const { profile, updateProfileData } = useAuth();
  
  // Real-time state
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PaymentRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PaymentRequest[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  
  // UI states
  const [activeSubTab, setActiveSubTab] = useState<'send' | 'request' | 'history' | 'earnings'>('send');
  const [requestTabMode, setRequestTabMode] = useState<'incoming' | 'outgoing'>('incoming');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Reels view-earnings states
  const [myReels, setMyReels] = useState<Reel[]>([]);
  
  // Withdrawal Form States
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [payoutMethod, setPayoutMethod] = useState<'upi' | 'bank'>('upi');
  const [upiId, setUpiId] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  
  // Form states
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [sendAmount, setSendAmount] = useState<string>('');
  const [sendReason, setSendReason] = useState<string>('');
  
  const [reqTargetUser, setReqTargetUser] = useState<string>('');
  const [reqAmount, setReqAmount] = useState<string>('');
  const [reqReason, setReqReason] = useState<string>('');
  
  const [buyCustomAmount, setBuyCustomAmount] = useState<string>('');
  const [userSearch, setUserSearch] = useState<string>('');
  
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 1. Listen for user transactions
  useEffect(() => {
    if (!profile) return;

    const tQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(tQuery, (snapshot) => {
      const tList: TransactionHistory[] = [];
      snapshot.forEach((doc) => {
        tList.push({ id: doc.id, ...doc.data() } as TransactionHistory);
      });
      tList.sort((a, b) => b.createdAt - a.createdAt);
      setTransactions(tList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  // 2. Listen for incoming payment requests
  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'payment_requests'),
      where('targetUserId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rList: PaymentRequest[] = [];
      snapshot.forEach((doc) => {
        rList.push({ id: doc.id, ...doc.data() } as PaymentRequest);
      });
      rList.sort((a, b) => b.createdAt - a.createdAt);
      setIncomingRequests(rList);
    });

    return () => unsubscribe();
  }, [profile]);

  // 3. Listen for outgoing payment requests
  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'payment_requests'),
      where('requesterId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rList: PaymentRequest[] = [];
      snapshot.forEach((doc) => {
        rList.push({ id: doc.id, ...doc.data() } as PaymentRequest);
      });
      rList.sort((a, b) => b.createdAt - a.createdAt);
      setOutgoingRequests(rList);
    });

    return () => unsubscribe();
  }, [profile]);

  // 4. Fetch all network users for payment selection
  useEffect(() => {
    if (!profile) return;

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uList: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const u = doc.data() as UserProfile;
        if (u.uid !== profile.uid) {
          uList.push(u);
        }
      });
      setAllUsers(uList);
    });

    return () => unsubscribe();
  }, [profile]);

  // 4b. Listen for current user's reels to aggregate views for monetization (10,000 views = 10 Rupees)
  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'reels'),
      where('authorId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rList: Reel[] = [];
      snapshot.forEach((doc) => {
        rList.push({ id: doc.id, ...doc.data() } as Reel);
      });
      setMyReels(rList);
    }, (error) => {
      console.error("Error fetching creator reels:", error);
    });

    return () => unsubscribe();
  }, [profile]);

  // Calculate views monetization
  const totalViews = myReels.reduce((sum, r) => sum + (r.viewsCount || 0), 0);
  const totalEarnedAmount = totalViews * 0.001; // 10000 views = ₹10 => 1 view = ₹0.001
  const alreadyWithdrawn = profile?.withdrawnEarnings || 0;
  const withdrawableAmount = Math.max(0, totalEarnedAmount - alreadyWithdrawn);

  // Direct withdrawal/payout transfer handler
  const handleWithdrawEarnings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage("कृपया निकासी के लिए एक वैध राशि दर्ज करें।");
      return;
    }

    if (amount > withdrawableAmount) {
      setErrorMessage(`अपर्याप्त बैलेंस! आप केवल ₹${withdrawableAmount.toFixed(2)} तक की निकासी कर सकते हैं।`);
      return;
    }

    if (payoutMethod === 'upi' && !upiId.trim()) {
      setErrorMessage("कृपया अपना UPI ID दर्ज करें।");
      return;
    }

    if (payoutMethod === 'bank' && (!bankName.trim() || !accountNumber.trim() || !ifscCode.trim())) {
      setErrorMessage("कृपया बैंक खाता की पूरी जानकारी दर्ज करें।");
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const batch = writeBatch(db);

      // 1. Increment withdrawnEarnings in user doc
      const userRef = doc(db, 'users', profile.uid);
      batch.update(userRef, {
        withdrawnEarnings: increment(amount)
      });

      // 2. Log in transactions collection
      const txRef = doc(collection(db, 'transactions'));
      const methodDetails = payoutMethod === 'upi' 
        ? `UPI ID: ${upiId.trim()}` 
        : `Bank: ${bankName.trim()} (खाता संख्या: ${accountNumber.trim()}, IFSC: ${ifscCode.trim()})`;

      batch.set(txRef, {
        userId: profile.uid,
        type: 'sent_payment',
        amount: -amount,
        description: `निकासी: ₹${amount.toFixed(2)} बैंक/UPI में ट्रांसफर किया (${methodDetails})`,
        createdAt: Date.now()
      });

      // 3. Create a payout request doc for accounting
      const payoutReqRef = doc(collection(db, 'payout_requests'));
      batch.set(payoutReqRef, {
        userId: profile.uid,
        userName: profile.displayName,
        amount: amount,
        method: payoutMethod,
        details: methodDetails,
        status: 'completed', // Auto-credited in simulation
        createdAt: Date.now()
      });

      await batch.commit();

      // Update local profile context
      await updateProfileData({ 
        withdrawnEarnings: (profile.withdrawnEarnings || 0) + amount 
      });

      setSuccessMessage(`सफलतापूर्वक ₹${amount.toFixed(2)} आपके खाते में ट्रांसफर कर दिए गए हैं!`);
      setWithdrawAmount('');
      setUpiId('');
      setBankName('');
      setAccountNumber('');
      setIfscCode('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage("निकासी प्रक्रिया विफल रही: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Clear messages automatically
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  // 5. Direct Money Send Handler (सिक्के भेजें)
  const handleSendCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    const amount = parseInt(sendAmount);
    if (!selectedUser) {
      setErrorMessage("कृपया प्राप्तकर्ता का चयन करें।");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage("कृपया एक वैध सिक्का राशि दर्ज करें।");
      return;
    }
    if ((profile.walletBalance || 0) < amount) {
      setErrorMessage(`अपर्याप्त बैलेंस! आपके पास केवल ⭐${profile.walletBalance || 0} कॉइन्स हैं।`);
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const recipient = allUsers.find(u => u.uid === selectedUser);
      if (!recipient) throw new Error("प्राप्तकर्ता नहीं मिला।");

      const batch = writeBatch(db);

      // Sender decrement
      const senderRef = doc(db, 'users', profile.uid);
      batch.update(senderRef, {
        walletBalance: increment(-amount)
      });

      // Recipient increment
      const recipientRef = doc(db, 'users', selectedUser);
      batch.update(recipientRef, {
        walletBalance: increment(amount)
      });

      // Transaction for sender
      const txSenderRef = doc(collection(db, 'transactions'));
      batch.set(txSenderRef, {
        userId: profile.uid,
        type: 'sent_payment',
        amount: -amount,
        description: `${recipient.displayName} को कॉइन्स भेजे (${sendReason || 'कोई कारण नहीं'})`,
        createdAt: Date.now()
      });

      // Transaction for recipient
      const txRecipientRef = doc(collection(db, 'transactions'));
      batch.set(txRecipientRef, {
        userId: selectedUser,
        type: 'received_payment',
        amount: amount,
        description: `${profile.displayName} से कॉइन्स प्राप्त हुए (${sendReason || 'कोई कारण नहीं'})`,
        createdAt: Date.now()
      });

      // Notification for recipient
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        recipientId: selectedUser,
        senderId: profile.uid,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL,
        type: 'gift',
        targetId: 'wallet',
        text: `ने आपको ⭐${amount} कॉइन्स भेजे हैं! (${sendReason || 'भुगतान'})`,
        read: false,
        createdAt: Date.now()
      });

      await batch.commit();

      // Local state update fallback if needed
      await updateProfileData({ walletBalance: (profile.walletBalance || 0) - amount });

      setSuccessMessage(`सफलतापूर्वक ${recipient.displayName} को ⭐${amount} कॉइन्स भेजे गए!`);
      setSendAmount('');
      setSendReason('');
      setSelectedUser('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage("भुगतान करने में त्रुटि आई: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // 6. Create Payment Request Handler (भुगतान अनुरोध बनाएं)
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const amount = parseInt(reqAmount);
    if (!reqTargetUser) {
      setErrorMessage("कृपया उस यूजर को चुनें जिससे सिक्के मंगवाने हैं।");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage("कृपया एक वैध सिक्का राशि दर्ज करें।");
      return;
    }
    if (!reqReason.trim()) {
      setErrorMessage("कृपया अनुरोध का कारण दर्ज करें (उदा. 'मदद के लिए')।");
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const targetUserObj = allUsers.find(u => u.uid === reqTargetUser);
      if (!targetUserObj) throw new Error("लक्षित यूजर नहीं मिला।");

      // Add to payment_requests collection
      await addDoc(collection(db, 'payment_requests'), {
        requesterId: profile.uid,
        requesterName: profile.displayName,
        requesterPhoto: profile.photoURL,
        targetUserId: reqTargetUser,
        targetUserName: targetUserObj.displayName,
        amount: amount,
        description: reqReason,
        status: 'pending',
        createdAt: Date.now()
      });

      // Add notification to target user
      await addDoc(collection(db, 'notifications'), {
        recipientId: reqTargetUser,
        senderId: profile.uid,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL,
        type: 'gift',
        targetId: 'wallet',
        text: `ने आपसे ⭐${amount} कॉइन्स का अनुरोध किया है: "${reqReason}"`,
        read: false,
        createdAt: Date.now()
      });

      setSuccessMessage(`${targetUserObj.displayName} से ⭐${amount} कॉइन्स का अनुरोध सफलतापूर्वक भेजा गया!`);
      setReqAmount('');
      setReqReason('');
      setReqTargetUser('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage("अनुरोध भेजने में त्रुटि: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // 7. Accept Incoming Request (भुगतान स्वीकार करें)
  const handleAcceptRequest = async (request: PaymentRequest) => {
    if (!profile) return;
    if ((profile.walletBalance || 0) < request.amount) {
      setErrorMessage(`अपर्याप्त बैलेंस! इस अनुरोध को पूरा करने के लिए आपको ⭐${request.amount} चाहिए, लेकिन आपके पास केवल ⭐${profile.walletBalance || 0} हैं।`);
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const batch = writeBatch(db);

      // 1. Update request status to accepted
      const reqRef = doc(db, 'payment_requests', request.id);
      batch.update(reqRef, { status: 'accepted' });

      // 2. Decrement current user balance
      const myRef = doc(db, 'users', profile.uid);
      batch.update(myRef, { walletBalance: increment(-request.amount) });

      // 3. Increment requester's balance
      const reqUserRef = doc(db, 'users', request.requesterId);
      batch.update(reqUserRef, { walletBalance: increment(request.amount) });

      // 4. Transaction history for current user
      const txMyRef = doc(collection(db, 'transactions'));
      batch.set(txMyRef, {
        userId: profile.uid,
        type: 'payment_request_accepted',
        amount: -request.amount,
        description: `${request.requesterName} का अनुरोध स्वीकार कर कॉइन्स भेजे: "${request.description}"`,
        createdAt: Date.now()
      });

      // 5. Transaction history for requester
      const txReqRef = doc(collection(db, 'transactions'));
      batch.set(txReqRef, {
        userId: request.requesterId,
        type: 'received_payment',
        amount: request.amount,
        description: `${profile.displayName} ने आपका भुगतान अनुरोध स्वीकार किया: "${request.description}"`,
        createdAt: Date.now()
      });

      // 6. Notification to requester
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        recipientId: request.requesterId,
        senderId: profile.uid,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL,
        type: 'friend_accepted',
        targetId: 'wallet',
        text: `ने आपका ⭐${request.amount} कॉइन्स का अनुरोध स्वीकार कर भुगतान कर दिया है!`,
        read: false,
        createdAt: Date.now()
      });

      await batch.commit();

      // Update local profile balance state
      await updateProfileData({ walletBalance: (profile.walletBalance || 0) - request.amount });
      setSuccessMessage(`अनुरोध स्वीकार किया गया और ⭐${request.amount} कॉइन्स सफलतापूर्वक भेज दिए गए!`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage("भुगतान अनुरोध स्वीकार करने में विफल: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // 8. Decline Incoming Request (अनुरोध अस्वीकार करें)
  const handleDeclineRequest = async (requestId: string, requesterId: string) => {
    if (!profile) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'payment_requests', requestId), {
        status: 'declined'
      });

      // Notify requester
      await addDoc(collection(db, 'notifications'), {
        recipientId: requesterId,
        senderId: profile.uid,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL,
        type: 'comment',
        targetId: 'wallet',
        text: `ने आपका कॉइन्स का अनुरोध अस्वीकार कर दिया है।`,
        read: false,
        createdAt: Date.now()
      });

      setSuccessMessage("अनुरोध को अस्वीकार कर दिया गया है।");
    } catch (err: any) {
      console.error(err);
      setErrorMessage("त्रुटि: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // 9. Buy/Add Coins simulation
  const handleBuyCoins = async (coins: number, price: number) => {
    if (!profile) return;
    setProcessing(true);
    try {
      const newBalance = (profile.walletBalance || 0) + coins;
      await updateProfileData({ walletBalance: newBalance });

      await addDoc(collection(db, 'transactions'), {
        userId: profile.uid,
        type: 'purchase_coins',
        amount: coins,
        description: `रिचार्ज: ${coins} Apna Coins खरीदे गए (UPI / कार्ड द्वारा)`,
        createdAt: Date.now()
      });

      setSuccessMessage(`बधाई हो! सफलतापूर्वक ${coins} कॉइन्स आपके वॉलेट में जोड़े गए। (सिम्युलेटेड भुगतान ₹${price})`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage("कॉइन्स खरीदने में विफल: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCustomBuyCoins = (e: React.FormEvent) => {
    e.preventDefault();
    const coins = parseInt(buyCustomAmount);
    if (isNaN(coins) || coins <= 0) {
      setErrorMessage("कृपया कॉइन्स की सही संख्या डालें।");
      return;
    }
    const price = Math.round(coins * 0.9); // 10% discount for custom / simulator
    handleBuyCoins(coins, price);
    setBuyCustomAmount('');
  };

  // Filter users list based on search
  const filteredUsers = allUsers.filter(u => {
    const dName = u.displayName || "";
    const email = u.email || "";
    const search = (userSearch || "").toLowerCase();
    return dName.toLowerCase().includes(search) || email.toLowerCase().includes(search);
  });

  return (
    <div className="space-y-6 pb-20">
      
      {/* WALLET DISPLAY CARD */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-900 via-indigo-900 to-slate-900 border border-violet-500/30 rounded-3xl p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-violet-300">
              <Wallet className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest">अपना वॉलेट बैलेंस (Apna Wallet)</span>
            </div>
            
            <div className="flex items-baseline gap-2">
              <span className="text-4xl md:text-5xl font-black text-white flex items-center gap-2">
                <span className="text-amber-400 animate-bounce">⭐</span>
                {profile?.walletBalance || 0}
              </span>
              <span className="text-sm font-semibold text-violet-200">Apna Coins</span>
            </div>
            
            <p className="text-xs text-slate-400 mt-2 max-w-md leading-relaxed">
              इन कॉइन्स का उपयोग आप अपने दोस्तों को भेजने, क्रिएटर्स को लाइव स्ट्रीमिंग में उपहार (Gifts) देने और पेमेंट रिक्वेस्ट पूरा करने में कर सकते हैं।
            </p>
          </div>

          {/* Quick Recharge Grid */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 w-full md:w-80">
            <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              त्वरित रिचार्ज (Quick Coins Recharge)
            </h4>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => handleBuyCoins(100, 99)}
                disabled={processing}
                className="p-2.5 bg-slate-950/80 hover:bg-slate-950 hover:border-violet-500 border border-slate-800 rounded-xl transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50"
              >
                <span className="text-xs font-black text-white">⭐ 100 कॉइन्स</span>
                <span className="text-[10px] text-emerald-400 font-bold">₹99.00</span>
              </button>
              <button
                onClick={() => handleBuyCoins(500, 399)}
                disabled={processing}
                className="p-2.5 bg-slate-950/80 hover:bg-slate-950 hover:border-violet-500 border border-slate-800 rounded-xl transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50"
              >
                <span className="text-xs font-black text-white">⭐ 500 कॉइन्स</span>
                <span className="text-[10px] text-emerald-400 font-bold">₹399.00</span>
              </button>
            </div>

            {/* Custom recharge */}
            <form onSubmit={handleCustomBuyCoins} className="flex gap-2">
              <input
                type="number"
                placeholder="Coins संख्या दर्ज करें"
                value={buyCustomAmount}
                onChange={(e) => setBuyCustomAmount(e.target.value)}
                className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={processing}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                खरीदें
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* FEEDBACK NOTIFICATION ALERTS */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center gap-2.5 shadow-md"
          >
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </motion.div>
        )}
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2.5 shadow-md"
          >
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-800/80 flex-wrap">
        <button
          onClick={() => { setActiveSubTab('send'); setErrorMessage(''); }}
          className={`flex-1 min-w-[120px] py-3 text-xs font-black transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${activeSubTab === 'send' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <Send className="w-4 h-4" />
          सिक्के भेजें (Send Coins)
        </button>
        <button
          onClick={() => { setActiveSubTab('request'); setErrorMessage(''); }}
          className={`flex-1 min-w-[120px] py-3 text-xs font-black transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${activeSubTab === 'request' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <Coins className="w-4 h-4" />
          भुगतान अनुरोध (Requests)
          {incomingRequests.filter(r => r.status === 'pending').length > 0 && (
            <span className="bg-rose-600 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-full animate-pulse">
              {incomingRequests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveSubTab('history'); setErrorMessage(''); }}
          className={`flex-1 min-w-[120px] py-3 text-xs font-black transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${activeSubTab === 'history' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <Clock className="w-4 h-4" />
          लेन-देन इतिहास (Ledger)
        </button>
        <button
          onClick={() => { setActiveSubTab('earnings'); setErrorMessage(''); }}
          className={`flex-1 min-w-[120px] py-3 text-xs font-black transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${activeSubTab === 'earnings' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          क्रिएटर कमाई (Earnings)
        </button>
      </div>

      {/* CORE TAB WORKSPACE */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-5 md:p-6 min-h-[300px]">
        
        {/* SUBTAB 1: SEND COINS */}
        {activeSubTab === 'send' && (
          <div className="space-y-6">
            <div className="flex items-start gap-3 bg-cyan-950/25 p-3.5 rounded-2xl border border-cyan-800/20 text-cyan-200">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                यहाँ से आप अपना सोशल नेटवर्क पर किसी भी दोस्त या यूजर को सीधे कॉइन्स भेज सकते हैं। प्राप्तकर्ता को तत्काल इसकी सूचना मिलेगी और उनके वॉलेट में कॉइन्स क्रेडिट हो जाएंगे।
              </p>
            </div>

            <form onSubmit={handleSendCoins} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {/* Search and User Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                    1. प्राप्तकर्ता चुनें (Select Recipient)
                  </label>
                  
                  {/* Search Input */}
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="यूजर का नाम या ईमेल खोजें..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Users selection scroll area */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-900/60">
                    {filteredUsers.length === 0 ? (
                      <p className="text-center text-slate-500 text-xs py-6">कोई अन्य यूजर नहीं मिला।</p>
                    ) : (
                      filteredUsers.map((u) => (
                        <button
                          type="button"
                          key={u.uid}
                          onClick={() => setSelectedUser(u.uid)}
                          className={`w-full flex items-center justify-between p-2.5 transition-all text-left ${selectedUser === u.uid ? 'bg-cyan-500/10 border-l-4 border-cyan-500' : 'hover:bg-slate-900/60'}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img src={u.photoURL} alt="" className="w-7 h-7 rounded-lg object-cover bg-slate-900" />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-200 block truncate">{u.displayName}</span>
                              <span className="text-[9px] text-slate-500 font-mono block truncate">{u.email}</span>
                            </div>
                          </div>
                          {selectedUser === u.uid && (
                            <span className="px-1.5 py-0.5 bg-cyan-600/20 text-cyan-400 text-[8px] font-bold rounded-md">चयनित</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Amount and Reason */}
              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                      2. कॉइन्स संख्या (Amount)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-amber-400 font-sans text-sm font-black">⭐</span>
                      <input
                        type="number"
                        placeholder="कितने सिक्के भेजने हैं?"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        min="1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                      3. भुगतान का विवरण / संदेश (Note)
                    </label>
                    <input
                      type="text"
                      placeholder="उदा. चाय का भुगतान, गिफ्ट, आदि..."
                      value={sendReason}
                      onChange={(e) => setSendReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="pt-4 md:pt-0">
                  <button
                    type="submit"
                    disabled={processing || !selectedUser || !sendAmount}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider shadow-lg shadow-cyan-500/10"
                  >
                    <Send className="w-4 h-4" />
                    {processing ? "ट्रांसफर हो रहा है..." : "सुरक्षित भुगतान करें (Send Coins)"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* SUBTAB 2: PAYMENT REQUESTS */}
        {activeSubTab === 'request' && (
          <div className="space-y-6">
            
            {/* Horizontal Toggler for Incoming vs Outgoing */}
            <div className="flex border-b border-slate-800/40 p-1 bg-slate-950/40 rounded-xl w-fit">
              <button
                onClick={() => setRequestTabMode('incoming')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${requestTabMode === 'incoming' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                प्राप्त अनुरोध (Incoming Requests)
                {incomingRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-rose-600 text-white text-[9px] rounded-full">
                    {incomingRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setRequestTabMode('outgoing')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${requestTabMode === 'outgoing' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                भेजे गए अनुरोध (Sent Requests)
              </button>
            </div>

            {/* MODE: INCOMING REQUESTS */}
            {requestTabMode === 'incoming' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-violet-950/25 p-3.5 rounded-2xl border border-violet-800/20 text-violet-200">
                  <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    यहाँ वे भुगतान अनुरोध हैं जो अन्य लोगों ने आपसे सिक्के मांगने के लिए किए हैं। आप उन्हें "अदा करें (Pay)" दबाकर भुगतान कर सकते हैं या "अस्वीकार" कर सकते हैं।
                  </p>
                </div>

                <div className="space-y-3">
                  {incomingRequests.length === 0 ? (
                    <div className="text-center py-12 bg-slate-950/20 rounded-2xl border border-dashed border-slate-800">
                      <p className="text-slate-500 text-xs">कोई भुगतान अनुरोध प्राप्त नहीं हुआ है।</p>
                    </div>
                  ) : (
                    incomingRequests.map((req) => (
                      <div 
                        key={req.id} 
                        className={`p-4 bg-slate-950 border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${req.status === 'pending' ? 'border-amber-500/30' : 'border-slate-800'}`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <img src={req.requesterPhoto} alt="" className="w-10 h-10 rounded-xl bg-slate-900 object-cover" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-200">{req.requesterName}</span>
                              <span className="text-[10px] text-slate-400">ने आपसे सिक्के मांगे</span>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-1 italic font-medium bg-slate-900/60 px-2 py-1 rounded-lg w-fit">
                              "{req.description}"
                            </p>
                            <span className="text-[9px] text-slate-500 mt-1 block">
                              अनुरोध तिथि: {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-900/80">
                          <div className="text-right">
                            <span className="text-lg font-black text-amber-400 block font-mono">⭐ {req.amount}</span>
                            <span className="text-[8px] text-slate-500 uppercase tracking-widest block font-bold">Coins Request</span>
                          </div>

                          <div className="flex gap-2">
                            {req.status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => handleDeclineRequest(req.id, req.requesterId)}
                                  disabled={processing}
                                  className="px-3 py-1.5 bg-slate-900 hover:bg-rose-950/40 hover:text-rose-400 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-800 hover:border-rose-900/50 disabled:opacity-50"
                                >
                                  अस्वीकार
                                </button>
                                <button
                                  onClick={() => handleAcceptRequest(req)}
                                  disabled={processing}
                                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow disabled:opacity-50"
                                >
                                  अदा करें (Pay)
                                </button>
                              </>
                            ) : req.status === 'accepted' ? (
                              <span className="flex items-center gap-1 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/20">
                                <CheckCircle className="w-3.5 h-3.5" />
                                भुगतान किया गया
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 px-3 py-1 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-xl border border-rose-500/20">
                                <XCircle className="w-3.5 h-3.5" />
                                अस्वीकृत
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* MODE: OUTGOING REQUESTS */}
            {requestTabMode === 'outgoing' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Form to Request Money */}
                <form onSubmit={handleCreateRequest} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 h-fit space-y-4">
                  <h4 className="text-xs font-black text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4" />
                    नया भुगतान अनुरोध बनाएं
                  </h4>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                      किससे मांगना है? (Target User)
                    </label>
                    <select
                      value={reqTargetUser}
                      onChange={(e) => setReqTargetUser(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="">-- यूजर का चयन करें --</option>
                      {allUsers.map(u => (
                        <option key={u.uid} value={u.uid}>
                          {u.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                      कितने कॉइन्स चाहिए? (Amount)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2.5 text-amber-400 text-xs">⭐</span>
                      <input
                        type="number"
                        placeholder="उदा. 200"
                        value={reqAmount}
                        onChange={(e) => setReqAmount(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                        min="1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                      कारण / विवरण (Reason)
                    </label>
                    <input
                      type="text"
                      placeholder="उदा. गेम टिकट के लिए, उधार, आदि..."
                      value={reqReason}
                      onChange={(e) => setReqReason(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={processing || !reqTargetUser || !reqAmount || !reqReason}
                    className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white font-black text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    सिक्के मांगें (Request Coins)
                  </button>
                </form>

                {/* Sent Requests List Ledger */}
                <div className="md:col-span-2 space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    आपके भेजे गए अनुरोध ({outgoingRequests.length})
                  </h4>

                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                    {outgoingRequests.length === 0 ? (
                      <div className="text-center py-12 bg-slate-950/10 rounded-2xl border border-slate-800">
                        <p className="text-slate-500 text-xs">आपने कोई पेमेंट रिक्वेस्ट नहीं भेजी है।</p>
                      </div>
                    ) : (
                      outgoingRequests.map((req) => (
                        <div key={req.id} className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-200 block truncate">
                              {req.targetUserName} से अनुरोध
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              "{req.description}"
                            </span>
                            <span className="text-[8px] text-slate-500 block">
                              दिनांक: {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="text-xs font-black text-amber-400 block">⭐ {req.amount}</span>
                            </div>

                            {req.status === 'pending' ? (
                              <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg">
                                विचाराधीन
                              </span>
                            ) : req.status === 'accepted' ? (
                              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                                स्वीकार किया
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg">
                                अस्वीकृत
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* SUBTAB 3: TRANSACTION LEDGER */}
        {activeSubTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">पूर्ण खाता-बही (Ledger Book)</span>
              <span className="text-[10px] text-slate-500">कुल लेन-देन: {transactions.length}</span>
            </div>

            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {transactions.length === 0 ? (
                <div className="text-center py-16 bg-slate-950/20 rounded-3xl border border-slate-850">
                  <p className="text-slate-500 text-xs">कोई लेन-देन नहीं पाया गया।</p>
                </div>
              ) : (
                transactions.map((t) => {
                  const isPositive = t.amount > 0;
                  return (
                    <div 
                      key={t.id} 
                      className="p-3 bg-slate-950/80 hover:bg-slate-950 border border-slate-850 rounded-2xl flex items-center justify-between gap-4 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-xl ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {isPositive ? (
                            <ArrowDownLeft className="w-5 h-5" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-black text-slate-200 block truncate">{t.description}</span>
                          <span className="text-[9px] text-slate-500 font-mono flex items-center gap-2">
                            <span>{new Date(t.createdAt).toLocaleString()}</span>
                            <span>•</span>
                            <span className="uppercase">{t.type.replace(/_/g, ' ')}</span>
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-sm font-black font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}{t.amount} कॉइन्स
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 4: CREATOR EARNINGS & WITHDRAWALS */}
        {activeSubTab === 'earnings' && (
          <div className="space-y-6">
            
            {/* Header info / rate badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-950/25 p-4 rounded-2xl border border-emerald-800/20 text-emerald-200">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">वीडियो मोनेटाइजेशन (Views Monetization)</h4>
                  <p className="text-[11px] leading-relaxed mt-0.5">
                    यहाँ आपके रील्स वीडियो के कुल व्यूज और कमाई का लाइव विवरण है। आप अपनी कमाई को सीधे बैंक खाते या UPI में ले सकते हैं।
                  </p>
                </div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl shrink-0 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black text-emerald-300">मोनेटाइजेशन रेट: 10,000 views = ₹10.00</span>
              </div>
            </div>

            {/* View Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Card 1: Total Views */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">कुल वीडियो व्यूज (Total Views)</span>
                  <span className="text-2xl font-black text-white block">{totalViews.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Tv className="w-3 h-3 text-cyan-400" />
                    <span>कुल {myReels.length} पब्लिश की गयी रील</span>
                  </span>
                </div>
                <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
                  <Eye className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Total Earned */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">कुल संचित कमाई (Total Earnings)</span>
                  <span className="text-2xl font-black text-emerald-400 block">₹{totalEarnedAmount.toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400">
                    व्यूज के आधार पर कैलकुलेटेड
                  </span>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>

              {/* Card 3: Withdrawable Balance */}
              <div className="bg-slate-950 border border-emerald-500/20 rounded-2xl p-5 flex items-center justify-between shadow-lg shadow-emerald-950/20">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">निकासी योग्य (Withdrawable)</span>
                  <span className="text-2xl font-black text-amber-400 block">₹{withdrawableAmount.toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400">
                    निकासी हो चुकी: ₹{alreadyWithdrawn.toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>

            </div>

            {/* WITHDRAWAL FLOW */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Form to Withdraw */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-900/60 pb-2.5">
                  <CreditCard className="w-4 h-4" />
                  कमाई अकाउंट में ट्रांसफर करें (Withdraw to Account)
                </h3>

                {withdrawableAmount <= 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                    <TrendingUp className="w-10 h-10 text-slate-700 animate-pulse" />
                    <span>आपके पास अभी कोई विदड्रॉ करने योग्य कमाई नहीं है।</span>
                    <span className="text-[10px] text-slate-600 mt-1">रील्स बनाएं और असली व्यूज बढ़ाकर कमाई करें!</span>
                  </div>
                ) : (
                  <form onSubmit={handleWithdrawEarnings} className="space-y-4">
                    
                    {/* Method selector */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">निकासी विधि (Payout Method)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPayoutMethod('upi')}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer ${payoutMethod === 'upi' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                        >
                          UPI (PhonePe/GPay)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayoutMethod('bank')}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer ${payoutMethod === 'bank' ? 'bg-violet-500/10 border-violet-500 text-violet-400' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                        >
                          Bank Account
                        </button>
                      </div>
                    </div>

                    {/* Amount input */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">निकासी राशि (Amount in ₹)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-450 text-xs">₹</span>
                        <input
                          type="number"
                          placeholder="कितने रुपये निकालने हैं?"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          max={withdrawableAmount}
                          min="1"
                          step="0.01"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-7 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 block mt-1">
                        अधिकतम स्वीकार्य राशि: ₹{withdrawableAmount.toFixed(2)}
                      </span>
                    </div>

                    {/* UPI input fields */}
                    {payoutMethod === 'upi' ? (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">अपना UPI ID (UPI Address)</label>
                        <input
                          type="text"
                          placeholder="उदा. username@okaxis, paytm, etc."
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    ) : (
                      // Bank input fields
                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">बैंक का नाम (Bank Name)</label>
                          <input
                            type="text"
                            placeholder="उदा. SBI, HDFC, ICICI"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">खाता संख्या (A/C No)</label>
                            <input
                              type="text"
                              placeholder="Account Number"
                              value={accountNumber}
                              onChange={(e) => setAccountNumber(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">IFSC कोड (IFSC Code)</label>
                            <input
                              type="text"
                              placeholder="SBIN0001234"
                              value={ifscCode}
                              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={processing || !withdrawAmount}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                    >
                      <ArrowRight className="w-4 h-4" />
                      {processing ? "ट्रांसफर हो रहा है..." : `खाते में ट्रांसफर करें (Withdraw ₹${parseFloat(withdrawAmount || '0').toFixed(2)})`}
                    </button>
                  </form>
                )}
              </div>

              {/* Video stats ledger list */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Tv className="w-4 h-4 text-cyan-400" />
                  <span>आपके वीडियो और उनके व्यूज ({myReels.length})</span>
                </h3>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {myReels.length === 0 ? (
                    <div className="text-center py-10 bg-slate-950/20 rounded-xl border border-dashed border-slate-800">
                      <p className="text-slate-500 text-xs">आपने अभी कोई रील पब्लिश नहीं की है।</p>
                    </div>
                  ) : (
                    myReels.map((reel) => {
                      const rViews = reel.viewsCount || 0;
                      const rEarnings = rViews * 0.001;
                      return (
                        <div key={reel.id} className="p-3 bg-slate-950/80 border border-slate-800/60 rounded-xl flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-slate-200 block truncate">{reel.caption}</span>
                            <span className="text-[9px] text-slate-500 block">अपलोड: {new Date(reel.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-cyan-400 block">{rViews.toLocaleString()} views</span>
                            <span className="text-[10px] font-black text-emerald-400 block">₹{rEarnings.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
};
