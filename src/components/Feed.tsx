import React, { useEffect, useState } from 'react';
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
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { Post, Comment, UserProfile } from '../types';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Image as ImageIcon, 
  Video, 
  Send, 
  Sparkles, 
  Globe, 
  Languages, 
  UserPlus, 
  Check, 
  FileText 
} from 'lucide-react';
import { motion } from 'motion/react';

// Preset high-quality images for easy visual post creation
const IMAGE_PRESETS = [
  { name: 'Travel', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80' },
  { name: 'Nature', url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=600&q=80' },
  { name: 'Coffee & Code', url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80' },
  { name: 'Sunset', url: 'https://images.unsplash.com/photo-1472214222555-d404758b1c42?auto=format&fit=crop&w=600&q=80' },
  { name: 'Food', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' }
];

export const Feed: React.FC = () => {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Post Creation States
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [showPresets, setShowPresets] = useState(false);
  
  // Gallery Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileSize, setUploadFileSize] = useState('');

  // AI assist states
  const [aiTopic, setAiTopic] = useState('');
  const [showAiHelper, setShowAiHelper] = useState(false);
  const [aiIdeas, setAiIdeas] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Comments and active interaction states
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<{ [postId: string]: Comment[] }>({});
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [aiCommentSuggestions, setAiCommentSuggestions] = useState<{ [postId: string]: string[] }>({});
  const [aiCommentLoading, setAiCommentLoading] = useState<string | null>(null);

  // Translations
  const [translatedTexts, setTranslatedTexts] = useState<{ [postId: string]: string }>({});
  const [translatingPostId, setTranslatingPostId] = useState<string | null>(null);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 480;
          const MAX_HEIGHT = 480;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 500MB strict validation (500एबी)
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

    const duration = Math.min(4000, Math.max(1000, (file.size / (1024 * 1024)) * 15));
    const step = 100 / (duration / 100);
    let currentProgress = 0;
    
    const interval = setInterval(() => {
      currentProgress = Math.min(98, currentProgress + step);
      setUploadProgress(Math.round(currentProgress));
    }, 100);

    try {
      const isImg = file.type.startsWith('image/');
      setMediaType(isImg ? 'image' : 'video');

      let resultUrl = '';
      if (isImg) {
        resultUrl = await compressImage(file);
      } else {
        resultUrl = URL.createObjectURL(file);
      }

      clearInterval(interval);
      setUploadProgress(100);
      setTimeout(() => {
        setMediaUrl(resultUrl);
        setIsUploading(false);
      }, 400);

    } catch (err) {
      console.error("Upload error:", err);
      clearInterval(interval);
      setIsUploading(false);
      alert("अपलोड करने में त्रुटि हुई!");
    }
  };

  // Connect to Posts in real-time
  useEffect(() => {
    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData: Post[] = [];
      snapshot.forEach((doc) => {
        postsData.push({ id: doc.id, ...doc.data() } as Post);
      });
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("Error reading posts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch comments for active post
  useEffect(() => {
    if (!activeCommentsPostId) return;

    const commentsQuery = query(
      collection(db, `posts/${activeCommentsPostId}/comments`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const commentsData: Comment[] = [];
      snapshot.forEach((doc) => {
        commentsData.push({ id: doc.id, ...doc.data() } as Comment);
      });
      setPostComments(prev => ({
        ...prev,
        [activeCommentsPostId]: commentsData
      }));
    });

    return () => unsubscribe();
  }, [activeCommentsPostId]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !mediaUrl) return;
    if (!profile) return;

    try {
      const newPost = {
        authorId: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        content: content.trim(),
        mediaUrl: mediaUrl || null,
        mediaType: mediaUrl ? mediaType : null,
        likes: [],
        commentsCount: 0,
        sharesCount: 0,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'posts'), newPost);
      
      // Clear inputs
      setContent('');
      setMediaUrl('');
      setShowPresets(false);
    } catch (error) {
      console.error("Error creating post:", error);
    }
  };

  const handleLikePost = async (postId: string, liked: boolean) => {
    if (!profile) return;
    const postRef = doc(db, 'posts', postId);
    try {
      if (liked) {
        await updateDoc(postRef, {
          likes: arrayRemove(profile.uid)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(profile.uid)
        });
        
        // Add notification for author
        const postObj = posts.find(p => p.id === postId);
        if (postObj && postObj.authorId !== profile.uid) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: postObj.authorId,
            senderId: profile.uid,
            senderName: profile.displayName,
            senderPhoto: profile.photoURL,
            type: 'like',
            targetId: postId,
            text: `${profile.displayName} ने आपकी पोस्ट को पसंद किया।`,
            read: false,
            createdAt: Date.now()
          });
        }
      }
    } catch (error) {
      console.error("Error liking post:", error);
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId];
    if (!text || !text.trim() || !profile) return;

    try {
      const commentObj = {
        postId,
        authorId: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        content: text.trim(),
        createdAt: Date.now()
      };

      await addDoc(collection(db, `posts/${postId}/comments`), commentObj);
      
      // Update comments counter
      const postRef = doc(db, 'posts', postId);
      const postObj = posts.find(p => p.id === postId);
      const newCount = (postObj?.commentsCount || 0) + 1;
      await updateDoc(postRef, {
        commentsCount: newCount
      });

      // Clear input & AI suggestions
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      setAiCommentSuggestions(prev => ({ ...prev, [postId]: [] }));

      // Create notification
      if (postObj && postObj.authorId !== profile.uid) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: postObj.authorId,
          senderId: profile.uid,
          senderName: profile.displayName,
          senderPhoto: profile.photoURL,
          type: 'comment',
          targetId: postId,
          text: `${profile.displayName} ने आपकी पोस्ट पर टिप्पणी की: "${text.trim().slice(0, 25)}..."`,
          read: false,
          createdAt: Date.now()
        });
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  // AI features - Post idea generation
  const handleGeneratePostIdeas = async () => {
    if (!aiTopic.trim()) return;
    setAiLoading(true);
    setAiIdeas([]);
    try {
      const response = await fetch('/api/ai/generate-post-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic })
      });
      const data = await response.json();
      if (data.ideas) {
        setAiIdeas(data.ideas);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAiLoading(false);
    }
  };

  // AI features - Suggest Comments
  const handleSuggestComments = async (postId: string, postContent: string) => {
    setAiCommentLoading(postId);
    try {
      const response = await fetch('/api/ai/suggest-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postContent })
      });
      const data = await response.json();
      if (data.comments) {
        setAiCommentSuggestions(prev => ({
          ...prev,
          [postId]: data.comments
        }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAiCommentLoading(null);
    }
  };

  // AI features - Translate Post Content
  const handleTranslatePost = async (postId: string, text: string) => {
    if (translatedTexts[postId]) {
      // Clear translation if already exists (toggle)
      setTranslatedTexts(prev => {
        const copy = { ...prev };
        delete copy[postId];
        return copy;
      });
      return;
    }

    setTranslatingPostId(postId);
    try {
      // Determine target language (if text has Hindi characters, translate to English, else translate to Hindi)
      const hasHindi = /[\u0900-\u097F]/.test(text);
      const targetLang = hasHindi ? 'English' : 'Hindi';

      const response = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang })
      });
      const data = await response.json();
      if (data.translatedText) {
        setTranslatedTexts(prev => ({
          ...prev,
          [postId]: data.translatedText
        }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setTranslatingPostId(null);
    }
  };

  const handleSharePost = async (postId: string) => {
    // Simply increment share count and show quick feedback
    try {
      const postRef = doc(db, 'posts', postId);
      const postObj = posts.find(p => p.id === postId);
      const newShares = (postObj?.sharesCount || 0) + 1;
      await updateDoc(postRef, {
        sharesCount: newShares
      });
      alert("Post Shared Successfully! (आपकी प्रोफाइल पर शेयर की गई)");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      
      {/* Create Post Card */}
      <div className="bg-slate-800 border border-slate-700/60 rounded-2xl p-4 shadow-xl">
        <form onSubmit={handleCreatePost} className="space-y-4">
          <div className="flex gap-3">
            <img 
              src={profile?.photoURL || "https://api.dicebear.com/7.x/adventurer/svg?seed=apna"} 
              alt="Avatar" 
              className="w-11 h-11 rounded-full object-cover border border-slate-600"
            />
            <div className="flex-1">
              <textarea
                placeholder="आज आपके मन में क्या है? (What's on your mind?)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                className="w-full bg-transparent border-0 text-white placeholder-slate-400 focus:outline-none resize-none text-base"
              />
            </div>
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="p-3 bg-slate-900 border border-slate-700/50 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-cyan-400 font-bold truncate max-w-[200px]">
                  📁 {uploadFileName} ({uploadFileSize})
                </span>
                <span className="text-slate-400 font-medium">अपलोड हो रहा है: {uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-violet-500 to-cyan-400 h-full transition-all duration-150" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {mediaUrl && (
            <div className="relative rounded-xl overflow-hidden border border-slate-700 max-h-80 bg-slate-900">
              {mediaType === 'image' ? (
                <img src={mediaUrl} alt="Upload preview" className="w-full h-full object-cover max-h-80" />
              ) : (
                <SafeVideo src={mediaUrl} controls className="w-full h-full max-h-80" />
              )}
              <button 
                type="button" 
                onClick={() => setMediaUrl('')}
                className="absolute top-2 right-2 p-1.5 bg-slate-950/80 hover:bg-slate-950 rounded-full text-slate-300 hover:text-white text-xs"
              >
                ✕ हटाएं
              </button>
            </div>
          )}

          {/* Quick Buttons */}
          <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-700/50 gap-2">
            <div className="flex flex-wrap gap-1.5">
              {/* Hidden file input for Gallery Upload */}
              <input 
                type="file"
                id="feed-gallery-input"
                accept="image/*,video/*"
                onChange={handleGalleryUpload}
                className="hidden"
              />
              <label
                htmlFor="feed-gallery-input"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600/30 to-cyan-500/20 hover:from-violet-600/50 hover:to-cyan-500/40 border border-violet-800/40 rounded-full text-xs text-cyan-300 font-bold transition-all cursor-pointer shadow-sm"
              >
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span>गैलरी से अपलोड (फोटो/वीडियो)</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setShowPresets(!showPresets);
                  setMediaType('image');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-full text-xs text-slate-300 font-medium transition-colors cursor-pointer"
              >
                <span>Preset</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const url = prompt("वीडियो URL दर्ज करें:");
                  if (url) {
                    setMediaUrl(url);
                    setMediaType('video');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-full text-xs text-slate-300 font-medium transition-colors cursor-pointer"
              >
                <span>वीडियो URL</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAiHelper(!showAiHelper)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-950/40 hover:bg-violet-950/70 border border-violet-800/40 rounded-full text-xs text-violet-300 font-medium transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span>AI</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={(!content.trim() && !mediaUrl) || isUploading}
              className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-700 hover:to-cyan-600 text-white rounded-full font-bold text-sm transition-all shadow-md shadow-violet-500/10 cursor-pointer disabled:opacity-40"
            >
              <span>पोस्ट करें</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Preset image selector */}
          {showPresets && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="pt-2"
            >
              <p className="text-xs text-slate-400 mb-2 font-medium">सुंदर फोटो थीम चुनें:</p>
              <div className="grid grid-cols-5 gap-2">
                {IMAGE_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setMediaUrl(p.url);
                      setMediaType('image');
                    }}
                    className="relative aspect-video rounded-lg overflow-hidden border border-slate-700 hover:border-cyan-400 transition-all cursor-pointer group"
                  >
                    <img src={p.url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    <span className="absolute inset-0 bg-black/40 flex items-center justify-center text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* AI Helper tool */}
          {showAiHelper && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-3.5 bg-slate-900/60 rounded-xl border border-violet-800/20 space-y-3"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="किस विषय पर पोस्ट लिखनी है? (उदा. चाय, सुबह की सैर, दोस्ती)"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="button"
                  onClick={handleGeneratePostIdeas}
                  disabled={aiLoading || !aiTopic}
                  className="px-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-40"
                >
                  {aiLoading ? 'बना रहा है...' : 'लिखें'}
                </button>
              </div>

              {aiIdeas.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">AI द्वारा सुझाए गए विचार (क्लिक करें):</p>
                  {aiIdeas.map((idea, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setContent(idea);
                        setShowAiHelper(false);
                      }}
                      className="w-full text-left p-2 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 rounded-lg text-xs text-slate-300 transition-all cursor-pointer"
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </form>
      </div>

      {/* Posts Feed */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-slate-800 h-40 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-10 bg-slate-800 rounded-2xl border border-slate-700/60">
          <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold">कोई पोस्ट नहीं मिली</h3>
          <p className="text-slate-400 text-sm mt-1">पहले पोस्ट करने वाले बनें!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const isLiked = profile ? post.likes.includes(profile.uid) : false;
            const hasTranslation = !!translatedTexts[post.id];

            return (
              <motion.div 
                key={post.id}
                layoutId={`post-${post.id}`}
                className="bg-slate-800 border border-slate-700/60 rounded-2xl p-4 shadow-lg flex flex-col gap-3"
              >
                {/* Post Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src={post.authorPhoto} 
                      alt={post.authorName} 
                      className="w-10 h-10 rounded-full border border-slate-600 object-cover"
                    />
                    <div>
                      <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1">
                        <span>{post.authorName}</span>
                        {/* Simulate verified mark */}
                        {post.likes.length >= 2 && (
                          <span className="inline-flex items-center justify-center bg-blue-500 p-0.5 rounded-full text-[7px] text-white">
                            ✓
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {new Date(post.createdAt).toLocaleDateString(undefined, { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>

                  {/* AI Translation Switcher */}
                  {post.content && (
                    <button
                      onClick={() => handleTranslatePost(post.id, post.content)}
                      disabled={translatingPostId === post.id}
                      className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                      title="Translate Post"
                    >
                      <Languages className="w-4 h-4" />
                      <span className="hidden sm:inline text-[10px]">
                        {translatingPostId === post.id 
                          ? 'अनुवाद...' 
                          : hasTranslation 
                            ? 'मूल देखें' 
                            : 'अनुवाद (Translate)'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Post Content */}
                <div className="space-y-2">
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {hasTranslation ? translatedTexts[post.id] : post.content}
                  </p>
                  {hasTranslation && (
                    <span className="inline-block text-[10px] text-cyan-400/80 bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 rounded font-medium">
                      ✨ Translated by AI
                    </span>
                  )}
                </div>

                {/* Post Media */}
                {post.mediaUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900 max-h-96">
                    {post.mediaType === 'video' ? (
                      <SafeVideo src={post.mediaUrl} controls className="w-full h-full max-h-96" />
                    ) : (
                      <img src={post.mediaUrl} alt="Post media" className="w-full h-full object-cover max-h-96" />
                    )}
                  </div>
                )}

                {/* Post Actions Stats */}
                <div className="flex items-center justify-between text-xs text-slate-400 px-1 border-b border-slate-700/40 pb-2">
                  <div className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    <span>{post.likes.length} Likes</span>
                  </div>
                  <div className="flex gap-3">
                    <span>{post.commentsCount} Comments</span>
                    <span>{post.sharesCount} Shares</span>
                  </div>
                </div>

                {/* Post Interaction Buttons */}
                <div className="flex items-center justify-around py-1 text-slate-300">
                  <button
                    onClick={() => handleLikePost(post.id, isLiked)}
                    className={`flex items-center gap-1.5 hover:bg-slate-700/50 py-1.5 px-3 rounded-xl text-xs transition-colors cursor-pointer ${isLiked ? 'text-rose-500 font-bold' : ''}`}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                    <span>पसंद (Like)</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveCommentsPostId(activeCommentsPostId === post.id ? null : post.id);
                    }}
                    className="flex items-center gap-1.5 hover:bg-slate-700/50 py-1.5 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-cyan-400" />
                    <span>टिप्पणी (Comment)</span>
                  </button>

                  <button
                    onClick={() => handleSharePost(post.id)}
                    className="flex items-center gap-1.5 hover:bg-slate-700/50 py-1.5 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-emerald-400" />
                    <span>शेयर (Share)</span>
                  </button>
                </div>

                {/* Comments Section Drawer (collapsible) */}
                {activeCommentsPostId === post.id && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="border-t border-slate-700/40 pt-3 mt-1 space-y-3"
                  >
                    {/* Add Comment Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="अपनी टिप्पणी लिखें..."
                        value={commentInputs[post.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCommentInputs(prev => ({ ...prev, [post.id]: val }));
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                      />
                      <button
                        onClick={() => handleSuggestComments(post.id, post.content)}
                        disabled={aiCommentLoading === post.id}
                        className="p-2 bg-violet-950 hover:bg-violet-900 border border-violet-800/50 text-violet-300 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
                        title="AI Suggested Comment"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={!(commentInputs[post.id]?.trim())}
                        className="p-2 bg-cyan-600 hover:bg-cyan-700 rounded-xl cursor-pointer shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>

                    {/* AI Suggested Comments display */}
                    {aiCommentSuggestions[post.id]?.length > 0 && (
                      <div className="p-2 bg-slate-900/40 rounded-xl border border-violet-800/10 space-y-1">
                        <p className="text-[9px] text-violet-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-violet-400 animate-pulse" />
                          <span>AI द्वारा सुझाई गई टिप्पणियां:</span>
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {aiCommentSuggestions[post.id].map((sug, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setCommentInputs(prev => ({ ...prev, [post.id]: sug }));
                              }}
                              className="text-[10px] text-left px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-lg text-slate-300 transition-colors cursor-pointer"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Comments List */}
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {!(postComments[post.id]?.length) ? (
                        <p className="text-center text-slate-500 text-xs py-2">कोई टिप्पणी नहीं है। पहली टिप्पणी करें!</p>
                      ) : (
                        postComments[post.id].map((comm) => (
                          <div key={comm.id} className="flex gap-2 p-2 bg-slate-900/30 rounded-xl">
                            <img 
                              src={comm.authorPhoto} 
                              alt={comm.authorName} 
                              className="w-7 h-7 rounded-full object-cover mt-0.5 border border-slate-700"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-300">{comm.authorName}</span>
                                <span className="text-[9px] text-slate-500">
                                  {new Date(comm.createdAt).toLocaleDateString(undefined, { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-slate-200 mt-0.5">{comm.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
