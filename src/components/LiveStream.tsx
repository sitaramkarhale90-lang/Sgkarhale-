import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { SafeVideo } from './SafeVideo';
import { 
  collection, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { LiveStream, LiveChatMessage, UserProfile } from '../types';
import { Video, Users, MessageSquare, Send, Sparkles, Heart, Gift, Radio, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const LiveStreamArea: React.FC = () => {
  const { profile, updateProfileData } = useAuth();
  
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  const [streamChats, setStreamChats] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLiveHost, setIsLiveHost] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');

  // Media Stream
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Chat scroll
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch active streams
  useEffect(() => {
    const q = query(collection(db, 'lives'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeList: LiveStream[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as LiveStream;
        if (data.active) {
          activeList.push({ id: doc.id, ...data });
        }
      });
      setStreams(activeList);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to Live Chat messages
  useEffect(() => {
    if (!activeStream) return;

    const q = query(
      collection(db, `lives/${activeStream.id}/chat`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats: LiveChatMessage[] = [];
      snapshot.forEach((doc) => chats.push({ id: doc.id, ...doc.data() } as LiveChatMessage));
      setStreamChats(chats);
    });

    return () => unsubscribe();
  }, [activeStream]);

  // Scroll live chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamChats]);

  const handleGoLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamTitle.trim() || !profile) return;

    try {
      // Capture local camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      setIsLiveHost(true);

      const streamId = `live_${profile.uid}`;
      const newLive: LiveStream = {
        id: streamId,
        hostId: profile.uid,
        hostName: profile.displayName,
        hostPhoto: profile.photoURL,
        title: streamTitle.trim(),
        active: true,
        viewers: [profile.uid],
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'lives', streamId), newLive);
      setActiveStream(newLive);

      // Play local feed
      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }, 300);

      // Send initial live system chat
      await addDoc(collection(db, `lives/${streamId}/chat`), {
        streamId,
        senderId: 'system',
        senderName: 'SYSTEM',
        senderPhoto: '',
        text: `🔴 ${profile.displayName} ने लाइव स्ट्रीमिंग शुरू कर दी है!`,
        createdAt: Date.now()
      });

    } catch (err: any) {
      console.error(err);
      alert("कैमरा या माइक्रोफ़ोन की अनुमति की आवश्यकता है!");
    }
  };

  const handleStopLive = async () => {
    if (!activeStream || !profile) return;

    // Stop camera tracks
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }

    // Set inactive in Firestore
    await updateDoc(doc(db, 'lives', activeStream.id), {
      active: false
    });

    setIsLiveHost(false);
    setActiveStream(null);
    setStreamTitle('');
  };

  const handleJoinStream = async (stream: LiveStream) => {
    if (!profile) return;
    setActiveStream(stream);
    setIsLiveHost(false);

    // Increment viewer count in Firestore
    await updateDoc(doc(db, 'lives', stream.id), {
      viewers: arrayUnion(profile.uid)
    });

    // Send join chat alert
    await addDoc(collection(db, `lives/${stream.id}/chat`), {
      streamId: stream.id,
      senderId: 'system',
      senderName: 'SYSTEM',
      senderPhoto: '',
      text: `👋 ${profile.displayName} स्ट्रीम में शामिल हुए।`,
      createdAt: Date.now()
    });
  };

  const handleLeaveStream = async () => {
    if (!activeStream || !profile) return;

    // Decrement viewer count
    await updateDoc(doc(db, 'lives', activeStream.id), {
      viewers: arrayRemove(profile.uid)
    });

    setActiveStream(null);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !profile || !activeStream) return;

    try {
      await addDoc(collection(db, `lives/${activeStream.id}/chat`), {
        streamId: activeStream.id,
        senderId: profile.uid,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL,
        text: chatInput.trim(),
        createdAt: Date.now()
      });

      setChatInput('');
    } catch (err) {
      console.error(err);
    }
  };

  // Gift stars (Monetization!)
  const handleSendGift = async () => {
    if (!profile || !activeStream) return;
    if (isLiveHost) {
      alert("आप स्वयं को उपहार नहीं भेज सकते!");
      return;
    }

    const starCost = 25; // Send 25 stars costs 25 coins

    if (profile.walletBalance < starCost) {
      alert("अपरियाप्त बैलेंस! उपहार भेजने के लिए प्रोफाइल में जाकर कॉइन्स खरीदें।");
      return;
    }

    try {
      // 1. Deduct viewer wallet balance
      const viewerNewBal = profile.walletBalance - starCost;
      await updateProfileData({ walletBalance: viewerNewBal });

      // 2. Add host wallet balance
      const hostRef = doc(db, 'users', activeStream.hostId);
      // Fetch current host balance first
      const hostSnap = await getDocs(query(collection(db, 'users'), orderBy('joinedAt')));
      let hostCurrentBal = 0;
      hostSnap.forEach(uDoc => {
        if (uDoc.id === activeStream.hostId) {
          hostCurrentBal = uDoc.data().walletBalance || 0;
        }
      });
      await updateDoc(hostRef, {
        walletBalance: hostCurrentBal + starCost
      });

      // 3. Post a beautifully highlighted Gift message inside the Live Chat
      await addDoc(collection(db, `lives/${activeStream.id}/chat`), {
        streamId: activeStream.id,
        senderId: 'gift_alert',
        senderName: profile.displayName,
        senderPhoto: profile.photoURL,
        text: `🎁 ने होस्ट को ⭐ ${starCost} स्टार्स का उपहार भेजा!`,
        createdAt: Date.now()
      });

      // 4. Record Transaction History in Firestore
      await addDoc(collection(db, 'transactions'), {
        userId: profile.uid,
        type: 'sent_gift',
        amount: -starCost,
        description: `Sent ⭐ Gift to ${activeStream.hostName}`,
        createdAt: Date.now()
      });

      await addDoc(collection(db, 'transactions'), {
        userId: activeStream.hostId,
        type: 'received_gift',
        amount: starCost,
        description: `Received ⭐ Gift from ${profile.displayName}`,
        createdAt: Date.now()
      });

      // 5. Add persistent system notification for host
      await addDoc(collection(db, 'notifications'), {
        recipientId: activeStream.hostId,
        senderId: profile.uid,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL,
        type: 'gift',
        targetId: activeStream.id,
        text: `${profile.displayName} ने आपको लाइव स्ट्रीम में ⭐ ${starCost} स्टार्स भेजे!`,
        read: false,
        createdAt: Date.now()
      });

    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      
      {activeStream ? (
        /* ACTIVE LIVESTREAM SCREEN */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[75vh]">
          
          {/* Main Video Screen */}
          <div className="md:col-span-2 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex flex-col justify-between relative shadow-2xl">
            {/* Live Badge Indicator */}
            <div className="absolute top-4 left-4 z-20 flex gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg animate-pulse">
                <Radio className="w-3 h-3" />
                LIVE
              </span>
              <span className="flex items-center gap-1 px-3 py-1 bg-black/60 backdrop-blur-md text-slate-300 text-[10px] font-bold rounded-full">
                <Users className="w-3 h-3 text-cyan-400" />
                {activeStream.viewers.length} Viewers
              </span>
            </div>

            {/* Title / Close controls */}
            <div className="absolute top-4 right-4 z-20">
              {isLiveHost ? (
                <button
                  onClick={handleStopLive}
                  className="px-3 py-1.5 bg-rose-700/80 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md transition-colors"
                >
                  स्ट्रीम बंद करें (End Live)
                </button>
              ) : (
                <button
                  onClick={handleLeaveStream}
                  className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Stream Video Feed */}
            <div className="flex-1 w-full h-full relative flex items-center justify-center bg-slate-900">
              {isLiveHost ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]" // mirror local camera
                />
              ) : (
                /* Simulated viewer feed - showing high fidelity loop or custom overlay */
                <div className="w-full h-full relative flex items-center justify-center bg-slate-900/40">
                  <SafeVideo
                    src="https://assets.mixkit.co/videos/preview/mixkit-young-woman-with-glasses-broadcasting-live-42250-large.mp4"
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Host Overlay banner */}
              <div className="absolute bottom-4 left-4 right-4 bg-black/50 backdrop-blur-md border border-white/10 p-3.5 rounded-xl z-10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img src={activeStream.hostPhoto} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-600 shadow" />
                  <div>
                    <h3 className="text-white text-xs font-bold leading-none">{activeStream.title}</h3>
                    <span className="text-[10px] text-slate-300">होस्ट: {activeStream.hostName}</span>
                  </div>
                </div>

                {/* Gift Monetization Stars Button for Viewer */}
                {!isLiveHost && (
                  <button
                    onClick={handleSendGift}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-black text-xs rounded-xl transition-all shadow-md cursor-pointer animate-bounce"
                  >
                    <Gift className="w-4 h-4 text-white" />
                    <span>स्टार भेजें (Send 25⭐)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Live Stream Chat section */}
          <div className="bg-slate-800 border border-slate-700/60 rounded-2xl flex flex-col justify-between overflow-hidden h-full shadow-lg">
            <div className="p-3.5 bg-slate-900/40 border-b border-slate-700/50 flex items-center justify-between">
              <h4 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                लाइव चैट (Live Chat)
              </h4>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-950/20">
              {streamChats.map((chat) => {
                const isSys = chat.senderId === 'system';
                const isGift = chat.senderId === 'gift_alert';
                
                if (isSys) {
                  return (
                    <div key={chat.id} className="text-center">
                      <span className="inline-block bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-[9px] text-rose-300 font-bold">
                        {chat.text}
                      </span>
                    </div>
                  );
                }

                if (isGift) {
                  return (
                    <div key={chat.id} className="p-2 bg-gradient-to-r from-amber-900/30 to-yellow-900/20 border border-amber-500/30 rounded-xl flex items-center gap-2">
                      <img src={chat.senderPhoto} alt="" className="w-6 h-6 rounded-full border border-amber-500" />
                      <div className="text-[10px]">
                        <span className="font-bold text-amber-300">{chat.senderName}</span>
                        <p className="text-yellow-100 font-bold">{chat.text}</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={chat.id} className="flex gap-2 items-start">
                    <img src={chat.senderPhoto} alt="" className="w-6 h-6 rounded-full object-cover border border-slate-700" />
                    <div className="bg-slate-900/50 px-2.5 py-1.5 rounded-xl border border-slate-800/40 flex-1">
                      <span className="font-bold text-[10px] text-slate-300">{chat.senderName}</span>
                      <p className="text-xs text-slate-100 mt-0.5 leading-tight">{chat.text}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Post Chat form */}
            <form onSubmit={handleSendChat} className="p-3 bg-slate-900/40 border-t border-slate-700/50 flex gap-2">
              <input
                type="text"
                placeholder="चैट संदेश भेजें..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      ) : (
        /* LIVE STREAMS LIST SCREEN */
        <div className="space-y-6">
          <div className="bg-slate-850 p-6 rounded-2xl border border-slate-700/50 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-rose-500 animate-pulse" />
                Apna Live Streaming
              </h2>
              <p className="text-xs text-slate-400">कैमरा चालू करें और तुरंत अपने प्रशंसकों के साथ लाइव जुड़ें।</p>
            </div>

            {/* Go Live Form Trigger */}
            <form onSubmit={handleGoLive} className="flex gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="लाइव का शीर्षक लिखें (Title)..."
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 w-full md:w-60"
                required
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
              >
                <Video className="w-4 h-4" />
                <span>लाइव जाएं (Go Live)</span>
              </button>
            </form>
          </div>

          {/* Active streams grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">सक्रिय लाइव ब्रॉडकास्ट (Active Lives)</h3>
            
            {streams.length === 0 ? (
              <div className="text-center py-20 bg-slate-800 rounded-3xl border border-slate-700/60 text-slate-400">
                <Radio className="w-12 h-12 text-slate-600 mx-auto mb-2 animate-pulse" />
                <p className="text-sm font-bold">अभी कोई लाइव स्ट्रीमिंग नहीं चल रही है</p>
                <p className="text-xs text-slate-500 mt-1">अपना लाइव शुरू करने के लिए ऊपर दिए फॉर्म का उपयोग करें!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {streams.map((s) => (
                  <div key={s.id} className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between">
                    <div className="h-40 relative bg-slate-950 flex items-center justify-center">
                      <SafeVideo
                        src="https://assets.mixkit.co/videos/preview/mixkit-young-woman-with-glasses-broadcasting-live-42250-large.mp4"
                        muted
                        loop
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover opacity-65"
                      />
                      <span className="absolute top-2 left-2 px-2.5 py-0.5 bg-rose-600 text-white text-[8px] font-extrabold uppercase tracking-widest rounded-full animate-pulse shadow">
                        LIVE
                      </span>
                      <span className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 text-slate-300 text-[8px] font-bold rounded-full">
                        {s.viewers.length} Viewers
                      </span>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <h4 className="font-bold text-xs text-white leading-tight line-clamp-1">{s.title}</h4>
                        <div className="flex items-center gap-2 mt-2">
                          <img src={s.hostPhoto} alt="" className="w-5 h-5 rounded-full object-cover" />
                          <span className="text-[10px] text-slate-400">{s.hostName}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleJoinStream(s)}
                        className="w-full py-2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-bold text-xs rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                      >
                        स्ट्रीम देखें (Join Live)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
