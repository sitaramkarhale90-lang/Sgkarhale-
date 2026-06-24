import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { SafeVideo } from './SafeVideo';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  increment
} from 'firebase/firestore';
import { Reel, Comment } from '../types';
import { 
  Heart, 
  MessageCircle, 
  Sparkles, 
  ChevronUp, 
  ChevronDown, 
  Plus, 
  Video, 
  Send,
  X,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const REEL_VIDEO_PRESETS = [
  { name: 'Waterfall Nature', url: 'https://assets.mixkit.co/videos/preview/mixkit-waterfall-in-forest-2213-large.mp4' },
  { name: 'City Skyline', url: 'https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-thick-fog-over-the-city-40118-large.mp4' },
  { name: 'Ocean Waves', url: 'https://assets.mixkit.co/videos/preview/mixkit-sea-water-waves-loop-33066-large.mp4' },
  { name: 'Guitar Playing', url: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-guitarist-playing-acoustic-guitar-42261-large.mp4' },
  { name: 'Abstract Cyberpunk', url: 'https://assets.mixkit.co/videos/preview/mixkit-futuristic-abstract-network-background-loop-42861-large.mp4' }
];

export const Reels: React.FC = () => {
  const { profile } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  // New Reel upload states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [reelVideoUrl, setReelVideoUrl] = useState('');
  const [reelCaption, setReelCaption] = useState('');
  
  // Gallery Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileSize, setUploadFileSize] = useState('');

  const handleReelGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict 500MB video upload validation (500एबी)
    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert(`फ़ाइल का आकार 500MB से अधिक नहीं होना चाहिए! आपकी फ़ाइल: ${(file.size / (1024 * 1024)).toFixed(1)}MB`);
      return;
    }

    const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    setUploadFileName(file.name);
    setUploadFileSize(sizeStr);
    setIsUploading(true);
    setUploadProgress(0);

    const duration = Math.min(4500, Math.max(1200, (file.size / (1024 * 1024)) * 15));
    const step = 100 / (duration / 100);
    let currentProgress = 0;

    const interval = setInterval(() => {
      currentProgress = Math.min(98, currentProgress + step);
      setUploadProgress(Math.round(currentProgress));
    }, 100);

    try {
      const resultUrl = URL.createObjectURL(file);

      clearInterval(interval);
      setUploadProgress(100);
      setTimeout(() => {
        setReelVideoUrl(resultUrl);
        setIsUploading(false);
      }, 400);

    } catch (err) {
      console.error("Video upload error:", err);
      clearInterval(interval);
      setIsUploading(false);
      alert("वीडियो अपलोड करने में विफल!");
    }
  };
  
  // AI Reel Helper
  const [aiTopic, setAiTopic] = useState('');
  const [aiCaptionLoading, setAiCaptionLoading] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  // Automatically read video duration (timer) when reelVideoUrl changes
  useEffect(() => {
    if (!reelVideoUrl) {
      setVideoDuration(null);
      return;
    }
    const tempVideo = document.createElement('video');
    tempVideo.src = reelVideoUrl;
    tempVideo.preload = 'metadata';
    const handleLoadedMetadata = () => {
      if (tempVideo.duration) {
        setVideoDuration(tempVideo.duration);
      }
    };
    tempVideo.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      tempVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [reelVideoUrl]);

  // Comments Panel State
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [activeComments, setActiveComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');

  // Video Refs
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});

  // Connect to Reels collection
  useEffect(() => {
    const reelsQuery = query(collection(db, 'reels'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(reelsQuery, (snapshot) => {
      const reelsData: Reel[] = [];
      snapshot.forEach((doc) => {
        reelsData.push({ id: doc.id, ...doc.data() } as Reel);
      });
      setReels(reelsData);
      setLoading(false);
    }, (error) => {
      console.error("Reels listening error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Control Video Autoplay when reel index changes
  useEffect(() => {
    if (reels.length === 0) return;

    // Pause all videos
    Object.keys(videoRefs.current).forEach((key) => {
      const vid = videoRefs.current[Number(key)];
      if (vid) {
        vid.pause();
        vid.currentTime = 0;
      }
    });

    // Play active video
    const activeVideo = videoRefs.current[currentIdx];
    if (activeVideo) {
      activeVideo.play().catch(err => {
        console.warn("Autoplay blocked by browser policy:", err);
      });

      // Quietly increment views for the active reel in Firestore if the viewer is not the author
      const activeReel = reels[currentIdx];
      if (activeReel && profile && activeReel.authorId !== profile.uid) {
        const reelRef = doc(db, 'reels', activeReel.id);
        updateDoc(reelRef, {
          viewsCount: increment(1)
        }).catch(err => console.warn("Failed to increment views:", err));
      }
    }
  }, [currentIdx, reels, profile?.uid]);

  // Read Comments for Active Reel
  useEffect(() => {
    if (reels.length === 0 || !showCommentsPanel) return;
    const activeReel = reels[currentIdx];

    const commentsQuery = query(
      collection(db, `reels/${activeReel.id}/comments`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const commList: Comment[] = [];
      snapshot.forEach((doc) => {
        commList.push({ id: doc.id, ...doc.data() } as Comment);
      });
      setActiveComments(commList);
    });

    return () => unsubscribe();
  }, [currentIdx, reels, showCommentsPanel]);

  const handleNextReel = () => {
    if (currentIdx < reels.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setShowCommentsPanel(false);
    }
  };

  const handlePrevReel = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      setShowCommentsPanel(false);
    }
  };

  const handleLikeReel = async () => {
    if (!profile || reels.length === 0) return;
    const activeReel = reels[currentIdx];
    const isLiked = activeReel.likes.includes(profile.uid);
    const reelRef = doc(db, 'reels', activeReel.id);

    try {
      if (isLiked) {
        await updateDoc(reelRef, {
          likes: arrayRemove(profile.uid)
        });
      } else {
        await updateDoc(reelRef, {
          likes: arrayUnion(profile.uid)
        });
        
        // Notification
        if (activeReel.authorId !== profile.uid) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: activeReel.authorId,
            senderId: profile.uid,
            senderName: profile.displayName,
            senderPhoto: profile.photoURL,
            type: 'like',
            targetId: activeReel.id,
            text: `${profile.displayName} ने आपका रील पसंद किया।`,
            read: false,
            createdAt: Date.now()
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handlePostReelComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !profile || reels.length === 0) return;
    const activeReel = reels[currentIdx];

    try {
      const commentObj = {
        postId: activeReel.id,
        authorId: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        content: newCommentText.trim(),
        createdAt: Date.now()
      };

      await addDoc(collection(db, `reels/${activeReel.id}/comments`), commentObj);

      // Increment count
      const reelRef = doc(db, 'reels', activeReel.id);
      await updateDoc(reelRef, {
        commentsCount: (activeReel.commentsCount || 0) + 1
      });

      setNewCommentText('');

      // Notification
      if (activeReel.authorId !== profile.uid) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: activeReel.authorId,
          senderId: profile.uid,
          senderName: profile.displayName,
          senderPhoto: profile.photoURL,
          type: 'comment',
          targetId: activeReel.id,
          text: `${profile.displayName} ने आपके रील पर कमेंट किया: "${newCommentText.trim().slice(0, 20)}..."`,
          read: false,
          createdAt: Date.now()
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleGenerateAiCaption = async () => {
    if (!aiTopic.trim()) return;
    setAiCaptionLoading(true);
    try {
      const response = await fetch('/api/ai/generate-post-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: `Reel Caption: ${aiTopic}` })
      });
      const data = await response.json();
      if (data.ideas && data.ideas.length > 0) {
        // Grab the first generated idea as our caption
        setReelCaption(data.ideas[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAiCaptionLoading(false);
    }
  };

  const handleUploadReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reelVideoUrl || !profile) return;

    try {
      const newReel = {
        authorId: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        videoUrl: reelVideoUrl,
        caption: reelCaption.trim() || 'Apna Reel Video! 🎥',
        likes: [],
        commentsCount: 0,
        viewsCount: 0,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'reels'), newReel);
      
      // Reset
      setReelVideoUrl('');
      setReelCaption('');
      setAiTopic('');
      setShowUploadModal(false);
      setCurrentIdx(0); // View the newest reel
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-md mx-auto h-[80vh] flex relative bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
      {loading ? (
        <div className="flex-1 flex flex-col justify-center items-center text-slate-400 gap-2">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm">रील्स लोड हो रही हैं...</span>
        </div>
      ) : reels.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center p-6 text-center text-slate-400">
          <Video className="w-12 h-12 text-slate-600 mb-2" />
          <p className="text-sm">कोई रील उपलब्ध नहीं है। पहली रील अपलोड करें!</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white rounded-full font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer"
          >
            रील्स अपलोड करें
          </button>
        </div>
      ) : (
        /* Reels Display Area */
        <div className="flex-1 relative h-full flex flex-col justify-center">
          
          {/* Active Reel Loop Video */}
          <div className="w-full h-full relative bg-slate-900 flex items-center justify-center">
            <SafeVideo
              ref={(el) => { videoRefs.current[currentIdx] = el; }}
              src={reels[currentIdx].videoUrl}
              loop
              playsInline
              className="w-full h-full object-contain"
              onClick={() => {
                const vid = videoRefs.current[currentIdx];
                if (vid) {
                  vid.paused ? vid.play() : vid.pause();
                }
              }}
            />

            {/* Dark bottom gradient overlay */}
            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>

            {/* Caption & Author Info */}
            <div className="absolute bottom-6 left-4 right-16 text-white z-10 space-y-2 pointer-events-auto">
              <div className="flex items-center gap-2">
                <img 
                  src={reels[currentIdx].authorPhoto} 
                  alt={reels[currentIdx].authorName} 
                  className="w-9 h-9 rounded-full border border-slate-600 object-cover shadow-md"
                />
                <span className="font-bold text-sm tracking-wide shadow-sm">{reels[currentIdx].authorName}</span>
                <span className="bg-cyan-500/80 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">CREATOR</span>
              </div>
              <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed shadow-sm">
                {reels[currentIdx].caption}
              </p>
            </div>

            {/* Right Action Bar (Likes, Comments, Add Reel) */}
            <div className="absolute right-4 bottom-10 flex flex-col items-center gap-5 z-20">
              {/* Creator upload button */}
              <button
                onClick={() => setShowUploadModal(true)}
                className="p-2.5 bg-gradient-to-tr from-violet-600 to-cyan-500 text-white rounded-full shadow-lg border border-slate-700/50 hover:scale-105 transition-transform cursor-pointer"
                title="Create Reel"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Views Count */}
              <div className="flex flex-col items-center gap-1">
                <div className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-cyan-400">
                  <Eye className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-200 shadow-sm">{reels[currentIdx].viewsCount || 0}</span>
              </div>

              {/* Like Button */}
              <button
                onClick={handleLikeReel}
                className="flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer group"
              >
                <div className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 group-hover:bg-black/60 transition-colors">
                  <Heart className={`w-5 h-5 ${profile && reels[currentIdx].likes.includes(profile.uid) ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
                </div>
                <span className="text-[10px] font-bold text-slate-200 shadow-sm">{reels[currentIdx].likes.length}</span>
              </button>

              {/* Comments Button */}
              <button
                onClick={() => setShowCommentsPanel(!showCommentsPanel)}
                className="flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer group"
              >
                <div className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 group-hover:bg-black/60 transition-colors">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-slate-200 shadow-sm">{reels[currentIdx].commentsCount || 0}</span>
              </button>
            </div>

            {/* Scroll Navigation arrows */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
              <button
                onClick={handlePrevReel}
                disabled={currentIdx === 0}
                className="p-2 bg-black/40 backdrop-blur-md border border-white/10 text-white rounded-full hover:bg-black/60 transition-colors disabled:opacity-20 cursor-pointer"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextReel}
                disabled={currentIdx === reels.length - 1}
                className="p-2 bg-black/40 backdrop-blur-md border border-white/10 text-white rounded-full hover:bg-black/60 transition-colors disabled:opacity-20 cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Collapsible Comments Panel Overlay */}
          <AnimatePresence>
            {showCommentsPanel && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute inset-x-0 bottom-0 h-2/3 bg-slate-900 border-t border-slate-800 rounded-t-2xl flex flex-col z-30 shadow-2xl"
              >
                <div className="flex items-center justify-between p-3.5 border-b border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">कमेंट्स ({activeComments.length})</h4>
                  <button onClick={() => setShowCommentsPanel(false)} className="text-slate-500 hover:text-white cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Comment lists */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {activeComments.length === 0 ? (
                    <p className="text-center text-slate-500 text-xs py-10">कोई कमेंट नहीं है। पहला कमेंट करें!</p>
                  ) : (
                    activeComments.map((comm) => (
                      <div key={comm.id} className="flex gap-2.5 items-start">
                        <img src={comm.authorPhoto} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-700 mt-0.5" />
                        <div className="flex-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/40">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-200">{comm.authorName}</span>
                            <span className="text-[9px] text-slate-500">{new Date(comm.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{comm.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* New comment input */}
                <form onSubmit={handlePostReelComment} className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
                  <input
                    type="text"
                    placeholder="कमेंट करें..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newCommentText.trim()}
                    className="p-2 bg-cyan-600 hover:bg-cyan-700 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Upload New Reel Modal */}
      {showUploadModal && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-200">🎥 नया रील अपलोड करें</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-500 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadReel} className="space-y-3">
              {/* Gallery Video Upload */}
              <div className="bg-slate-950 border border-slate-800/60 p-3 rounded-xl space-y-2">
                <label className="block text-[10px] text-cyan-400 font-bold uppercase tracking-wider">गैलरी से अपलोड करें (अधिकतम 500MB):</label>
                
                <input 
                  type="file" 
                  id="reel-gallery-input" 
                  accept="video/*" 
                  onChange={handleReelGalleryUpload} 
                  className="hidden"
                />
                <label 
                  htmlFor="reel-gallery-input" 
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-violet-600/30 to-cyan-500/20 hover:from-violet-600/40 hover:to-cyan-500/30 border border-violet-800/40 rounded-xl text-xs text-cyan-300 font-bold transition-all cursor-pointer shadow-sm text-center"
                >
                  <Video className="w-4 h-4 text-cyan-400" />
                  <span>गैलरी से वीडियो चुनें (Select Video)</span>
                </label>

                {isUploading && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-cyan-400 font-medium truncate max-w-[150px]">📁 {uploadFileName}</span>
                      <span className="text-slate-400">{uploadProgress}% ({uploadFileSize})</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-violet-500 to-cyan-400 h-full transition-all duration-150" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {reelVideoUrl && !isUploading && (
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold pt-1">
                    ✓ वीडियो सफलतापूर्वक चुना गया!
                  </div>
                )}
              </div>

              {/* Preset selectors for easier demoing */}
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">या Preset वीडियो लिंक चुनें:</label>
                <div className="flex flex-wrap gap-1">
                  {REEL_VIDEO_PRESETS.map((p, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setReelVideoUrl(p.url)}
                      className={`text-[9px] px-2 py-1 rounded-md border cursor-pointer font-medium ${reelVideoUrl === p.url ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-800/60 border-slate-700 text-slate-400'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">वीडियो लिंक (URL):</label>
                <input
                  type="url"
                  placeholder="https://assets.mixkit.co/..."
                  value={reelVideoUrl}
                  onChange={(e) => setReelVideoUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Displaying video duration / timer */}
              {reelVideoUrl && (
                <div className="flex justify-between items-center bg-slate-950 border border-slate-800/60 px-3 py-2.5 rounded-xl">
                  <span className="text-[10px] text-pink-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    ⏱️ रील का समय (Reel Timer):
                  </span>
                  <span className="text-xs text-pink-300 font-extrabold bg-pink-950/40 px-2.5 py-0.5 rounded-md border border-pink-800/40">
                    {videoDuration !== null ? `${videoDuration.toFixed(1)} सेकंड` : 'लोड हो रहा है...'}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">कैप्शन (Caption):</label>
                <textarea
                  placeholder="अपना कैप्शन लिखें..."
                  value={reelCaption}
                  onChange={(e) => setReelCaption(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              {/* AI Assistant for Captions */}
              <div className="bg-slate-950 border border-slate-800/60 rounded-xl p-2.5 space-y-2">
                <p className="text-[9px] text-violet-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  <span>AI कैप्शन सहायक</span>
                </p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="विषय: (उदा: मजेदार बिल्ली, प्रकृति सौंदर्य)"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateAiCaption}
                    disabled={aiCaptionLoading || !aiTopic}
                    className="px-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                  >
                    {aiCaptionLoading ? '...' : 'बनाएं'}
                  </button>
                </div>
              </div>

              {/* Real Views counter indicator as requested */}
              <div className="flex justify-between items-center bg-slate-950 border border-slate-800/60 px-3 py-2.5 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">शुरुआती व्यूज (Initial Views):</span>
                <span className="text-xs text-cyan-400 font-extrabold bg-cyan-950/40 px-2 py-0.5 rounded-md border border-cyan-800/40">0 (असली / Real Views)</span>
              </div>

              <button
                type="submit"
                disabled={!reelVideoUrl}
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-700 hover:to-cyan-600 text-white font-bold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-40"
              >
                पब्लिश करें (Publish Reel)
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
