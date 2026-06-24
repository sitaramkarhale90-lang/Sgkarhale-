import React, { useEffect, useState, useRef } from 'react';
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
  setDoc,
  where,
  updateDoc
} from 'firebase/firestore';
import { Chat, Message, UserProfile } from '../types';
import { Send, Sparkles, MessageSquare, Search, PhoneCall } from 'lucide-react';
import { motion } from 'motion/react';

export const Messenger: React.FC = () => {
  const { profile } = useAuth();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  
  // Selected other user profile to chat with
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // AI replying states
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Message scroll element
  const msgEndRef = useRef<HTMLDivElement>(null);

  // Fetch all users in network to let them chat with anyone
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const usersList: UserProfile[] = [];
        querySnapshot.forEach((doc) => {
          const u = doc.data() as UserProfile;
          if (profile && u.uid !== profile.uid) {
            usersList.push(u);
          }
        });
        setUsers(usersList);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUsers();
  }, [profile]);

  // Scroll to bottom whenever messages list changes
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Start or open Chat between profile and selectedUser
  const handleSelectUser = async (otherUser: UserProfile) => {
    if (!profile) return;
    setSelectedUser(otherUser);
    setAiSuggestions([]);

    // Sort uids to construct a unique chat session ID (e.g. uid1_uid2)
    const sortedUids = [profile.uid, otherUser.uid].sort();
    const chatId = sortedUids.join('_');

    const chatRef = doc(db, 'chats', chatId);
    const chatDoc = {
      id: chatId,
      participants: [profile.uid, otherUser.uid]
    };

    // Store or create chat document
    await setDoc(chatRef, chatDoc, { merge: true });
    setActiveChat(chatDoc as Chat);

    // Subscribe to messages
    const messagesQuery = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setChatMessages(msgs);
    });

    return () => unsubscribe();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !profile || !activeChat || !selectedUser) return;

    try {
      const msgObj = {
        chatId: activeChat.id,
        senderId: profile.uid,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL,
        text: newMessageText.trim(),
        createdAt: Date.now()
      };

      await addDoc(collection(db, `chats/${activeChat.id}/messages`), msgObj);

      // Update last message details in chat document
      const chatRef = doc(db, 'chats', activeChat.id);
      await updateDoc(chatRef, {
        lastMessage: newMessageText.trim(),
        lastMessageTime: Date.now()
      });

      setNewMessageText('');
      setAiSuggestions([]);

      // Create notification for other user
      await addDoc(collection(db, 'notifications'), {
        recipientId: selectedUser.uid,
        senderId: profile.uid,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL,
        type: 'gift', // Generic icon or custom type
        targetId: activeChat.id,
        text: `${profile.displayName} ने आपको एक नया संदेश भेजा।`,
        read: false,
        createdAt: Date.now()
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // AI Reply Suggestions
  const handleGenerateAiReplies = async () => {
    if (chatMessages.length === 0) return;
    
    // Grab the last message from the other participant to generate replies for
    const lastIncomingMessage = [...chatMessages]
      .reverse()
      .find(m => m.senderId !== profile?.uid);

    if (!lastIncomingMessage) {
      // If there are no incoming messages, suggest ice breakers
      setAiSuggestions([
        "हैलो! आप कैसे हैं? 😊",
        "नमस्ते! आज का दिन कैसा रहा?",
        "Hey! Long time no talk, how are you?"
      ]);
      return;
    }

    setAiLoading(true);
    try {
      const response = await fetch('/api/ai/suggest-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postContent: `Private Chat Message: ${lastIncomingMessage.text}` })
      });
      const data = await response.json();
      if (data.comments) {
        setAiSuggestions(data.comments);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="h-[75vh] flex bg-slate-800 border border-slate-700/60 rounded-3xl overflow-hidden shadow-xl">
      {/* Users/Chats list Sidebar */}
      <div className="w-1/3 border-r border-slate-700/50 flex flex-col bg-slate-900/40">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-sm text-slate-200">मैसेंजर चैट (Chats)</h3>
            <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 font-bold px-2 py-0.5 rounded-full">
              {users.length} Users
            </span>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="यूजर खोजें..."
              className="w-full bg-slate-900 border border-slate-700/50 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500 text-white"
            />
          </div>
        </div>

        {/* Users list scroll */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {users.length === 0 ? (
            <p className="text-center text-slate-500 text-xs py-10">कोई यूजर उपलब्ध नहीं है।</p>
          ) : (
            users.map((u) => {
              const isSelected = selectedUser?.uid === u.uid;
              return (
                <button
                  key={u.uid}
                  onClick={() => handleSelectUser(u)}
                  className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-colors cursor-pointer ${isSelected ? 'bg-cyan-950/40 border border-cyan-800/40 text-white' : 'hover:bg-slate-700/40 text-slate-300'}`}
                >
                  <img src={u.photoURL} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-700" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs truncate block">{u.displayName}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 truncate block mt-0.5">{u.bio || 'Available'}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-800">
        {selectedUser ? (
          <>
            {/* Active chat header */}
            <div className="p-4 border-b border-slate-700/50 bg-slate-900/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={selectedUser.photoURL} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-700" />
                <div>
                  <h4 className="font-extrabold text-xs text-white">{selectedUser.displayName}</h4>
                  <span className="text-[9px] text-emerald-400 font-semibold tracking-wider uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Online
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {/* Audio/Video call decorative button */}
                <button 
                  onClick={() => alert(`Calling ${selectedUser.displayName}... (Simulating voice/video integration)`)}
                  className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white cursor-pointer transition-colors"
                >
                  <PhoneCall className="w-4 h-4 text-cyan-400" />
                </button>
              </div>
            </div>

            {/* Messages body scroll */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/10">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 text-slate-500 space-y-2">
                  <MessageSquare className="w-10 h-10 text-slate-600 animate-bounce" />
                  <p className="text-xs">चैट प्रारंभ करें! अपना पहला संदेश भेजें।</p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isOwn = profile && msg.senderId === profile.uid;
                  return (
                    <div 
                      key={msg.id}
                      className={`flex gap-2 max-w-[80%] ${isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                    >
                      {!isOwn && (
                        <img src={msg.senderPhoto} alt="" className="w-6 h-6 rounded-full object-cover border border-slate-700 mt-1" />
                      )}
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed border ${isOwn ? 'bg-cyan-600 border-cyan-500 text-white rounded-tr-none' : 'bg-slate-700/60 border-slate-600 text-slate-100 rounded-tl-none'}`}>
                        <p>{msg.text}</p>
                        <span className="block text-[8px] opacity-60 text-right mt-1 font-mono">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={msgEndRef} />
            </div>

            {/* AI Assistant response suggestions panel */}
            {aiSuggestions.length > 0 && (
              <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-700/30 flex flex-wrap gap-1.5 items-center">
                <span className="text-[9px] text-violet-400 font-bold uppercase tracking-wider flex items-center gap-1 mr-1 shrink-0">
                  <Sparkles className="w-3 h-3 text-violet-400 animate-pulse" />
                  <span>AI Reply:</span>
                </span>
                {aiSuggestions.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => setNewMessageText(sug)}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1 rounded-full transition-all cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}

            {/* Input send message box */}
            <form onSubmit={handleSendMessage} className="p-3.5 border-t border-slate-700/50 bg-slate-900/20 flex gap-2">
              <button
                type="button"
                onClick={handleGenerateAiReplies}
                disabled={aiLoading}
                className="p-2 bg-violet-950/80 border border-violet-800/40 text-violet-300 rounded-xl text-xs font-semibold cursor-pointer shrink-0 hover:bg-violet-900"
                title="Generate AI Reply Suggestions"
              >
                <Sparkles className="w-4 h-4 text-violet-400" />
              </button>

              <input
                type="text"
                placeholder="अपना संदेश लिखें..."
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />

              <button
                type="submit"
                disabled={!newMessageText.trim()}
                className="p-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl cursor-pointer disabled:opacity-40 transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-grow flex flex-col justify-center items-center p-6 text-center text-slate-500 space-y-2">
            <MessageSquare className="w-14 h-14 text-slate-600" />
            <h3 className="font-bold text-sm text-slate-400">अपना मैसेंजर चैट बॉक्स</h3>
            <p className="text-xs max-w-xs">चैटिंग शुरू करने के लिए बाईं ओर दी गई सूची से किसी भी मित्र या यूजर का चयन करें!</p>
          </div>
        )}
      </div>
    </div>
  );
};
