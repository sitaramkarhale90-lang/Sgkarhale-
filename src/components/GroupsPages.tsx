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
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { Group, Page, Post } from '../types';
import { Users, FileText, Plus, ShieldCheck, HelpCircle, ArrowRight, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';

export const GroupsPages: React.FC = () => {
  const { profile } = useAuth();
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [activeTab, setActiveTab] = useState<'groups' | 'pages'>('groups');
  
  // Create dialog selectors
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createCategory, setCreateCategory] = useState('Entertainment'); // default for Page
  const [createCover, setCreateCover] = useState('https://images.unsplash.com/photo-1557683316-973673baf926'); // solid background template

  // Selected group/page Wall details
  const [selectedWall, setSelectedWall] = useState<{ type: 'group' | 'page'; data: any } | null>(null);
  const [wallPosts, setWallPosts] = useState<Post[]>([]);
  const [newWallPostText, setNewWallPostText] = useState('');

  // Fetch groups & pages
  useEffect(() => {
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snap) => {
      const groupList: Group[] = [];
      snap.forEach((doc) => groupList.push({ id: doc.id, ...doc.data() } as Group));
      setGroups(groupList);
    });

    const unsubPages = onSnapshot(collection(db, 'pages'), (snap) => {
      const pageList: Page[] = [];
      snap.forEach((doc) => pageList.push({ id: doc.id, ...doc.data() } as Page));
      setPages(pageList);
    });

    return () => {
      unsubGroups();
      unsubPages();
    };
  }, []);

  // Fetch dedicated Wall posts
  useEffect(() => {
    if (!selectedWall) return;

    // We can query posts matching the pageId or groupId
    const q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsList: Post[] = [];
      snapshot.forEach((doc) => {
        const p = doc.data() as Post;
        // Check if this post content has group/page specific identifier
        // Or if the content contains #groupId or #pageId to simulate dedicated feed
        if (p.content.includes(`#${selectedWall.data.id}`)) {
          postsList.push({ id: doc.id, ...p });
        }
      });
      setWallPosts(postsList);
    });

    return () => unsubscribe();
  }, [selectedWall]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !profile) return;

    try {
      if (activeTab === 'groups') {
        const newGroup = {
          name: createName,
          description: createDesc,
          coverUrl: createCover,
          members: [profile.uid],
          creatorId: profile.uid,
          createdAt: Date.now()
        };
        await addDoc(collection(db, 'groups'), newGroup);
      } else {
        const newPage = {
          name: createName,
          category: createCategory,
          description: createDesc,
          logoUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${createName}`,
          coverUrl: createCover,
          followers: [profile.uid],
          creatorId: profile.uid,
          createdAt: Date.now()
        };
        await addDoc(collection(db, 'pages'), newPage);
      }

      // Reset
      setCreateName('');
      setCreateDesc('');
      setShowCreateModal(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleJoinLeaveGroup = async (group: Group, isJoined: boolean) => {
    if (!profile) return;
    const groupRef = doc(db, 'groups', group.id);
    try {
      if (isJoined) {
        await updateDoc(groupRef, {
          members: arrayRemove(profile.uid)
        });
      } else {
        await updateDoc(groupRef, {
          members: arrayUnion(profile.uid)
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleFollowUnfollowPage = async (page: Page, isFollowing: boolean) => {
    if (!profile) return;
    const pageRef = doc(db, 'pages', page.id);
    try {
      if (isFollowing) {
        await updateDoc(pageRef, {
          followers: arrayRemove(profile.uid)
        });
      } else {
        await updateDoc(pageRef, {
          followers: arrayUnion(profile.uid)
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handlePostToWall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWallPostText.trim() || !profile || !selectedWall) return;

    try {
      const wallId = selectedWall.data.id;
      const displayTag = activeTab === 'groups' ? `(Group Post)` : `(Page Update)`;
      
      const newPost = {
        authorId: profile.uid,
        authorName: `${profile.displayName} ${displayTag}`,
        authorPhoto: profile.photoURL,
        // Tag with wallId for filtering in the wall query
        content: `${newWallPostText.trim()}\n\n#${wallId}`,
        likes: [],
        commentsCount: 0,
        sharesCount: 0,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'posts'), newPost);
      setNewWallPostText('');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* Wall Display Header */}
      {selectedWall ? (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl"
        >
          {/* Wall Cover Photo */}
          <div className="h-36 relative bg-slate-900">
            <img src={selectedWall.data.coverUrl} alt="" className="w-full h-full object-cover opacity-60" />
            <button
              onClick={() => setSelectedWall(null)}
              className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 hover:bg-black rounded-lg text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              ← वापस जाएं (All List)
            </button>
          </div>

          <div className="p-4 flex gap-4 items-end -mt-8 relative z-10">
            {selectedWall.type === 'page' ? (
              <img src={selectedWall.data.logoUrl} alt="" className="w-20 h-20 rounded-2xl bg-slate-700 p-1 border-4 border-slate-800 object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-slate-700 flex items-center justify-center border-4 border-slate-800 text-cyan-400">
                <Users className="w-10 h-10" />
              </div>
            )}
            <div className="flex-1 pb-1">
              <h2 className="text-xl font-extrabold text-white">{selectedWall.data.name}</h2>
              <p className="text-xs text-slate-400 mt-1">{selectedWall.data.description}</p>
            </div>
          </div>

          {/* Wall dedicated post editor */}
          <div className="p-4 border-t border-slate-700/40 bg-slate-900/10 space-y-4">
            <form onSubmit={handlePostToWall} className="space-y-3">
              <textarea
                placeholder="इस वॉल पर एक नया संदेश लिखें... (Write something here)"
                value={newWallPostText}
                onChange={(e) => setNewWallPostText(e.target.value)}
                rows={2}
                className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newWallPostText.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-700 hover:to-cyan-600 text-white rounded-full font-bold text-xs transition-all cursor-pointer disabled:opacity-40"
                >
                  वॉल पर पोस्ट करें (Post to Wall)
                </button>
              </div>
            </form>

            {/* Wall Posts list */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">वॉल की पोस्ट्स ({wallPosts.length})</h3>
              {wallPosts.length === 0 ? (
                <p className="text-center text-slate-500 text-xs py-10 bg-slate-900/20 border border-slate-800/40 rounded-2xl">
                  इस ग्रुप/पेज की कोई पोस्ट नहीं है। पहली पोस्ट करें!
                </p>
              ) : (
                wallPosts.map((post) => (
                  <div key={post.id} className="p-3.5 bg-slate-900/20 border border-slate-700/30 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2">
                      <img src={post.authorPhoto} alt="" className="w-8 h-8 rounded-full border border-slate-700 object-cover" />
                      <div>
                        <h4 className="font-bold text-xs text-slate-200">{post.authorName}</h4>
                        <span className="text-[9px] text-slate-500">{new Date(post.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    {/* Clean out the hash tag identifier for display */}
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {post.content.replace(`#${selectedWall.data.id}`, '')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        /* List Tab View */
        <>
          <div className="flex items-center justify-between">
            {/* Tab switchers */}
            <div className="flex bg-slate-800 border border-slate-700/40 p-1.5 rounded-xl">
              <button
                onClick={() => { setActiveTab('groups'); setSelectedWall(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'groups' ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                ग्रुप (Groups)
              </button>
              <button
                onClick={() => { setActiveTab('pages'); setSelectedWall(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'pages' ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                पेज (Pages)
              </button>
            </div>

            {/* Create Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-xl text-xs text-slate-200 font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>{activeTab === 'groups' ? 'नया ग्रुप' : 'नया पेज'}</span>
            </button>
          </div>

          {/* Grid display */}
          {activeTab === 'groups' ? (
            /* Groups Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {groups.length === 0 ? (
                <div className="col-span-full text-center py-20 bg-slate-800 rounded-3xl border border-slate-700/50 text-slate-400">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm">कोई ग्रुप नहीं मिला।</p>
                </div>
              ) : (
                groups.map((group) => {
                  const isJoined = profile ? group.members.includes(profile.uid) : false;
                  return (
                    <div key={group.id} className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between">
                      <div className="h-24 relative bg-slate-900">
                        <img src={group.coverUrl} alt="" className="w-full h-full object-cover opacity-55" />
                        <span className="absolute top-2 right-2 text-[9px] bg-black/60 text-slate-300 font-bold px-2 py-0.5 rounded-full border border-white/10">
                          {group.members.length} Members
                        </span>
                      </div>
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-extrabold text-sm text-white line-clamp-1">{group.name}</h3>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{group.description}</p>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleJoinLeaveGroup(group, isJoined)}
                            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isJoined ? 'bg-slate-700 text-slate-300' : 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white'}`}
                          >
                            {isJoined ? 'Joined' : 'Join Group'}
                          </button>
                          
                          <button
                            onClick={() => setSelectedWall({ type: 'group', data: group })}
                            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-cyan-400 cursor-pointer"
                            title="Visit Wall"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Pages Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pages.length === 0 ? (
                <div className="col-span-full text-center py-20 bg-slate-800 rounded-3xl border border-slate-700/50 text-slate-400">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm">कोई पेज नहीं मिला।</p>
                </div>
              ) : (
                pages.map((page) => {
                  const isFollowing = profile ? page.followers.includes(profile.uid) : false;
                  return (
                    <div key={page.id} className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between">
                      <div className="h-24 relative bg-slate-900">
                        <img src={page.coverUrl} alt="" className="w-full h-full object-cover opacity-55" />
                        <span className="absolute top-2 right-2 text-[9px] bg-black/60 text-slate-300 font-bold px-2 py-0.5 rounded-full border border-white/10">
                          {page.category}
                        </span>
                      </div>
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div className="flex gap-3 items-start">
                          <img src={page.logoUrl} alt="" className="w-11 h-11 rounded-xl bg-slate-700 p-0.5 border border-slate-600 object-cover mt-0.5" />
                          <div>
                            <h3 className="font-extrabold text-sm text-white line-clamp-1 flex items-center gap-1">
                              <span>{page.name}</span>
                              <span className="bg-blue-500 p-0.5 rounded-full text-[6px] text-white">✓</span>
                            </h3>
                            <span className="text-[9px] text-slate-500 font-medium">{page.followers.length} Followers</span>
                            <p className="text-xs text-slate-400 mt-1 line-clamp-1">{page.description}</p>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleFollowUnfollowPage(page, isFollowing)}
                            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isFollowing ? 'bg-slate-700 text-slate-300' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}
                          >
                            {isFollowing ? 'Following' : 'Follow Page'}
                          </button>
                          
                          <button
                            onClick={() => setSelectedWall({ type: 'page', data: page })}
                            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-cyan-400 cursor-pointer"
                            title="Visit Page Wall"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-200">
                {activeTab === 'groups' ? '👥 नया ग्रुप बनाएं' : '📄 नया पेज बनाएं'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">नाम (Name):</label>
                <input
                  type="text"
                  placeholder="उदा. चाय लवर्स, मोटिवेशन पॉइंट"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              {activeTab === 'pages' && (
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">श्रेणी (Category):</label>
                  <select
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="Entertainment">Entertainment</option>
                    <option value="Business">Business</option>
                    <option value="Technology">Technology</option>
                    <option value="Motivation">Motivation</option>
                    <option value="Local Creator">Local Creator</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">विवरण (Description):</label>
                <textarea
                  placeholder="इसके बारे में कुछ लिखें..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">कवर फोटो लिंक (Cover URL):</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={createCover}
                  onChange={(e) => setCreateCover(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-700 hover:to-cyan-600 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                {activeTab === 'groups' ? 'ग्रुप क्रिएट करें' : 'पेज क्रिएट करें'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
