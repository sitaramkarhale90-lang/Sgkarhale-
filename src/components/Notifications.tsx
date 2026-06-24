import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { 
  collection, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  where,
  deleteDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { NotificationItem, UserProfile } from '../types';
import { Bell, UserPlus, Check, X, Sparkles, Heart, MessageCircle, Gift, Radio, Eye } from 'lucide-react';
import { motion } from 'motion/react';

export const Notifications: React.FC = () => {
  const { profile, updateProfileData } = useAuth();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [friendRequests, setFriendRequests] = useState<UserProfile[]>([]);
  const [potentialFriends, setPotentialFriends] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'notifications' | 'friends'>('notifications');

  // Fetch notifications
  useEffect(() => {
    if (!profile) return;

    const nQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(nQuery, (snapshot) => {
      const nList: NotificationItem[] = [];
      snapshot.forEach((doc) => {
        nList.push({ id: doc.id, ...doc.data() } as NotificationItem);
      });
      setNotifications(nList);
    });

    return () => unsubscribe();
  }, [profile]);

  // Fetch all other users to list as potential friends
  useEffect(() => {
    if (!profile) return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const plist: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const u = doc.data() as UserProfile;
        // Do not display yourself or those who are already your friends
        const isAlreadyFriend = profile.friends?.includes(u.uid);
        if (u.uid !== profile.uid && !isAlreadyFriend) {
          plist.push(u);
        }
      });
      setPotentialFriends(plist);
    });

    return () => unsubUsers();
  }, [profile]);

  const handleMarkAsRead = async (notifId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notifId);
      await updateDoc(notifRef, { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  // Send friend request (simulated directly by creating a Notification with type 'friend_request')
  const handleSendFriendRequest = async (targetUser: UserProfile) => {
    if (!profile) return;

    try {
      // Avoid duplicate requests by placing record
      await addDoc(collection(db, 'notifications'), {
        recipientId: targetUser.uid,
        senderId: profile.uid,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL,
        type: 'friend_request',
        targetId: profile.uid, // sender ID
        text: `${profile.displayName} ने आपको मित्र बनाने का अनुरोध भेजा है।`,
        read: false,
        createdAt: Date.now()
      });

      alert(`${targetUser.displayName} को मित्र अनुरोध भेजा गया!`);
    } catch (err) {
      console.error(err);
    }
  };

  // Accept Friend Request
  const handleAcceptRequest = async (notif: NotificationItem) => {
    if (!profile) return;

    try {
      const myRef = doc(db, 'users', profile.uid);
      const friendRef = doc(db, 'users', notif.senderId);

      // Add to friends lists
      await updateDoc(myRef, {
        friends: arrayUnion(notif.senderId)
      });
      await updateDoc(friendRef, {
        friends: arrayUnion(profile.uid)
      });

      // 1. Delete or update the request notification to prevent reuse
      const notifRef = doc(db, 'notifications', notif.id);
      await deleteDoc(notifRef);

      // 2. Send accepted notification to friend
      await addDoc(collection(db, 'notifications'), {
        recipientId: notif.senderId,
        senderId: profile.uid,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL,
        type: 'friend_accepted',
        targetId: profile.uid,
        text: `🎉 ${profile.displayName} ने आपका मित्र अनुरोध स्वीकार कर लिया है!`,
        read: false,
        createdAt: Date.now()
      });

      alert(`बधाई हो! अब आप और ${notif.senderName} दोस्त हैं।`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineRequest = async (notifId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notifId);
      await deleteDoc(notifRef);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-10">
      
      {/* Tab Switcher */}
      <div className="flex bg-slate-800 border border-slate-700/40 p-1.5 rounded-xl w-full">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'notifications' ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
        >
          सूचनाएं (Notifications)
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-rose-600 text-white text-[9px] rounded-full">
              {notifications.filter(n => !n.read).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'friends' ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
        >
          मित्र खोजें (Find Friends)
        </button>
      </div>

      {activeTab === 'notifications' ? (
        /* Notifications List */
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-20 bg-slate-800 rounded-3xl border border-slate-700/50 text-slate-400">
              <Bell className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-sm">अभी कोई सूचना नहीं है।</p>
            </div>
          ) : (
            notifications.map((n) => {
              const isReq = n.type === 'friend_request';
              
              // Map types to beautiful color icons
              let iconElement = <Bell className="w-4 h-4 text-cyan-400" />;
              if (n.type === 'like') iconElement = <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
              if (n.type === 'comment') iconElement = <MessageCircle className="w-4 h-4 text-teal-400" />;
              if (n.type === 'gift') iconElement = <Gift className="w-4 h-4 text-amber-500" />;
              if (n.type === 'friend_accepted') iconElement = <UserPlus className="w-4 h-4 text-emerald-400" />;

              return (
                <div 
                  key={n.id} 
                  onClick={() => !n.read && handleMarkAsRead(n.id)}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-3 ${n.read ? 'bg-slate-800/40 border-slate-700/30' : 'bg-slate-800 border-slate-700/70 shadow-md'}`}
                >
                  <div className="flex gap-3 items-start">
                    <div className="p-2 bg-slate-900 rounded-xl shrink-0">
                      {iconElement}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <img src={n.senderPhoto || "https://api.dicebear.com/7.x/adventurer/svg?seed=apna"} alt="" className="w-6 h-6 rounded-full object-cover border border-slate-700 shrink-0" />
                        <span className="font-extrabold text-xs text-white truncate">{n.senderName}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5 leading-normal">{n.text}</p>
                      <span className="text-[9px] text-slate-500 font-mono mt-1 block">
                        {new Date(n.createdAt).toLocaleDateString()} at {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 mt-2"></span>
                    )}
                  </div>

                  {/* Accept / Decline action block for friend request notifications */}
                  {isReq && (
                    <div className="flex gap-2 pl-12">
                      <button
                        onClick={() => handleAcceptRequest(n)}
                        className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>स्वीकार करें (Accept)</span>
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(n.id)}
                        className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>खारिज करें</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Find Friends Panel */
        <div className="space-y-4">
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-700/50">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">खोजें नए दोस्त (Find Potential Friends)</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">मित्रों को जोड़कर आप उनके साथ सीधे संदेश भेज सकते हैं और उनकी विशेष गतिविधियां देख सकते हैं।</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {potentialFriends.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-10 col-span-2">मित्र अनुरोध भेजने के लिए कोई अन्य यूजर नहीं मिला।</p>
            ) : (
              potentialFriends.map((u) => (
                <div key={u.uid} className="bg-slate-800 border border-slate-700/60 p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={u.photoURL} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-extrabold text-xs text-white truncate block">{u.displayName}</span>
                      <span className="text-[10px] text-slate-500 truncate block mt-0.5">{u.bio || 'Hi there!'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSendFriendRequest(u)}
                    className="p-2 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/40 text-cyan-400 hover:text-white rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center shrink-0"
                    title="Send Friend Request"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};
