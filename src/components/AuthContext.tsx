import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithDemo: (displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfileData: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Monitor auth state changes
  useEffect(() => {
    // Check if there is a saved demo user first
    const savedDemoUser = localStorage.getItem('apna_demo_user');
    const savedDemoProfile = localStorage.getItem('apna_demo_profile');
    if (savedDemoUser && savedDemoProfile) {
      setUser(JSON.parse(savedDemoUser));
      setProfile(JSON.parse(savedDemoProfile));
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // If there is currently a demo user, don't let firebase state override it unless signed out
      if (localStorage.getItem('apna_demo_user')) return;

      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch or create user profile in Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Listen to profile updates in real-time with resilient offline fallback
        const unsubscribeProfile = onSnapshot(userRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as UserProfile;
            setProfile(data);
            localStorage.setItem(`apna_profile_${firebaseUser.uid}`, JSON.stringify(data));
          } else {
            // Profile doesn't exist yet, create a default one
            const defaultProfile: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Apna User',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firebaseUser.uid}`,
              bio: 'नमस्ते! मैं अपना सोशल नेटवर्क का उपयोग कर रहा हूँ।',
              walletBalance: 250, // Give 250 free initial coins to play with monetization
              friends: [],
              joinedAt: Date.now()
            };
            try {
              await setDoc(userRef, defaultProfile);
            } catch (setDocErr) {
              console.warn("Could not create default profile in Firestore on snapshot missing:", setDocErr);
            }
            setProfile(defaultProfile);
            localStorage.setItem(`apna_profile_${firebaseUser.uid}`, JSON.stringify(defaultProfile));
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile snapshot listener error, using cache/fallback:", error);
          const cached = localStorage.getItem(`apna_profile_${firebaseUser.uid}`);
          if (cached) {
            setProfile(JSON.parse(cached));
          } else {
            // Setup local state profile fallback
            const fallbackProfile: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Apna User',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firebaseUser.uid}`,
              bio: 'नमस्ते! मैं अपना सोशल नेटवर्क का उपयोग कर रहा हूँ।',
              walletBalance: 250,
              friends: [],
              joinedAt: Date.now()
            };
            setProfile(fallbackProfile);
            localStorage.setItem(`apna_profile_${firebaseUser.uid}`, JSON.stringify(fallbackProfile));
          }
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const getLocalUid = (email: string) => {
    return 'email_' + email.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');
  };

  const loginWithEmail = async (email: string, pass: string) => {
    localStorage.removeItem('apna_demo_user');
    localStorage.removeItem('apna_demo_profile');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: any) {
      const isAuthDisabled = err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed');
      const isUserNotFound = err.code === 'auth/user-not-found' || err.message?.includes('user-not-found');
      const isWrongPassword = err.code === 'auth/wrong-password' || err.message?.includes('wrong-password');
      
      if (isAuthDisabled || isUserNotFound || isWrongPassword) {
        console.warn("Firebase Auth Email/Password fallback triggered. Checking Firestore storage...");
        const localUid = getLocalUid(email);
        const userRef = doc(db, 'users', localUid);
        
        let docSnap;
        try {
          docSnap = await getDoc(userRef);
        } catch (getDocErr: any) {
          console.warn("Firestore getDoc failed due to connection/offline, checking local storage cache...", getDocErr);
          const cachedProfileStr = localStorage.getItem(`apna_profile_${localUid}`);
          if (cachedProfileStr) {
            const cachedProfile = JSON.parse(cachedProfileStr);
            if (cachedProfile._fallbackPassword === pass) {
              const fallbackUser = {
                uid: localUid,
                displayName: cachedProfile.displayName,
                email: email.toLowerCase().trim(),
                photoURL: cachedProfile.photoURL,
                emailVerified: true
              } as any as FirebaseUser;

              localStorage.setItem('apna_demo_user', JSON.stringify(fallbackUser));
              localStorage.setItem('apna_demo_profile', JSON.stringify(cachedProfile));
              setUser(fallbackUser);
              setProfile(cachedProfile);
              return;
            } else {
              throw new Error("गलत पासवर्ड! कृपया पुनः प्रयास करें।");
            }
          }
          
          // Generate a user profile on the fly to prevent blocking the user
          console.log("No local cache found and Firestore offline. Auto-generating local fallback profile...");
          const displayName = email.split('@')[0];
          const fallbackUser = {
            uid: localUid,
            displayName: displayName,
            email: email.toLowerCase().trim(),
            photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${localUid}`,
            emailVerified: true
          } as any as FirebaseUser;

          const fallbackProfile: UserProfile = {
            uid: localUid,
            displayName: displayName,
            email: email.toLowerCase().trim(),
            photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${localUid}`,
            bio: 'नमस्ते! मैं ऑफलाइन मोड में अपना सोशल नेटवर्क का उपयोग कर रहा हूँ।',
            walletBalance: 250,
            friends: [],
            joinedAt: Date.now(),
            _fallbackPassword: pass
          } as any;

          localStorage.setItem('apna_demo_user', JSON.stringify(fallbackUser));
          localStorage.setItem('apna_demo_profile', JSON.stringify(fallbackProfile));
          localStorage.setItem(`apna_profile_${localUid}`, JSON.stringify(fallbackProfile));
          setUser(fallbackUser);
          setProfile(fallbackProfile);
          return;
        }
        
        if (docSnap && docSnap.exists()) {
          const profileData = docSnap.data() as any;
          if (profileData._fallbackPassword === pass) {
            const fallbackUser = {
              uid: localUid,
              displayName: profileData.displayName,
              email: email.toLowerCase().trim(),
              photoURL: profileData.photoURL,
              emailVerified: true
            } as any as FirebaseUser;

            localStorage.setItem('apna_demo_user', JSON.stringify(fallbackUser));
            localStorage.setItem('apna_demo_profile', JSON.stringify(profileData));
            localStorage.setItem(`apna_profile_${localUid}`, JSON.stringify(profileData));
            setUser(fallbackUser);
            setProfile(profileData);
            return;
          } else {
            throw new Error("गलत पासवर्ड! कृपया पुनः प्रयास करें।");
          }
        } else {
          if (isAuthDisabled) {
            throw new Error("यह ईमेल पंजीकृत नहीं है! कृपया पहले 'अकाउंट बनाएं' (Sign Up) पर जाएं।");
          }
          throw err;
        }
      } else {
        throw err;
      }
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    localStorage.removeItem('apna_demo_user');
    localStorage.removeItem('apna_demo_profile');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      await updateProfile(cred.user, {
        displayName: name,
        photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${cred.user.uid}`
      });
      
      // Create the profile document
      const userRef = doc(db, 'users', cred.user.uid);
      const defaultProfile: UserProfile = {
        uid: cred.user.uid,
        displayName: name,
        email: email.toLowerCase().trim(),
        photoURL: cred.user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cred.user.uid}`,
        bio: 'नमस्ते! मैं अपना सोशल नेटवर्क का उपयोग कर रहा हूँ।',
        walletBalance: 250, // Give 250 free initial coins
        friends: [],
        joinedAt: Date.now()
      };
      try {
        await setDoc(userRef, defaultProfile);
      } catch (dbErr) {
        console.warn("Could not write default profile to Firestore during standard signup:", dbErr);
      }
      localStorage.setItem(`apna_profile_${cred.user.uid}`, JSON.stringify(defaultProfile));
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        console.warn("Firebase Auth Email/Password provider not enabled. Registering securely in Firestore...");
        
        const localUid = getLocalUid(email);
        const userRef = doc(db, 'users', localUid);
        
        let docSnap;
        try {
          docSnap = await getDoc(userRef);
        } catch (getDocErr: any) {
          console.warn("Firestore check before signup failed due to offline/connection, checking local storage:", getDocErr);
          const cachedProfileStr = localStorage.getItem(`apna_profile_${localUid}`);
          if (cachedProfileStr) {
            throw new Error("यह ईमेल पहले से इस डिवाइस पर पंजीकृत है! कृपया लॉगिन करें।");
          }
          // Proceed with local registration
          docSnap = { exists: () => false };
        }
        
        if (docSnap && docSnap.exists()) {
          throw new Error("यह ईमेल पहले से पंजीकृत है! कृपया लॉगिन करें।");
        }

        const fallbackUser = {
          uid: localUid,
          displayName: name,
          email: email.toLowerCase().trim(),
          photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${localUid}`,
          emailVerified: true
        } as any as FirebaseUser;

        const fallbackProfile: UserProfile = {
          uid: localUid,
          displayName: name,
          email: email.toLowerCase().trim(),
          photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${localUid}`,
          bio: 'नमस्ते! मैं अपना सोशल नेटवर्क का उपयोग कर रहा हूँ।',
          walletBalance: 250,
          friends: [],
          joinedAt: Date.now(),
          _fallbackPassword: pass
        } as any;

        try {
          await setDoc(userRef, fallbackProfile);
        } catch (dbErr) {
          console.warn("Could not sync fallbackProfile to Firestore, using offline cache:", dbErr);
        }
        
        localStorage.setItem('apna_demo_user', JSON.stringify(fallbackUser));
        localStorage.setItem('apna_demo_profile', JSON.stringify(fallbackProfile));
        localStorage.setItem(`apna_profile_${localUid}`, JSON.stringify(fallbackProfile));
        setUser(fallbackUser);
        setProfile(fallbackProfile);
      } else {
        throw err;
      }
    }
  };

  const loginWithGoogle = async () => {
    localStorage.removeItem('apna_demo_user');
    localStorage.removeItem('apna_demo_profile');
    await signInWithPopup(auth, googleProvider);
  };

  const loginWithDemo = async (displayName?: string) => {
    const defaultName = displayName || "अतिथि यूजर (Guest)";
    const mockUid = "demo_user_123";
    const mockUser = {
      uid: mockUid,
      displayName: defaultName,
      email: "guest@apnasocial.com",
      photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${mockUid}`,
      emailVerified: true
    } as any as FirebaseUser;

    const mockProfile: UserProfile = {
      uid: mockUid,
      displayName: defaultName,
      email: "guest@apnasocial.com",
      photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${mockUid}`,
      bio: 'नमस्ते! मैं बिना पासवर्ड/लॉगिन के इस नेटवर्क का उपयोग कर रहा हूँ (डेमो मोड)।',
      walletBalance: 500, // Give some sweet coins to play with!
      friends: [],
      joinedAt: Date.now()
    };

    localStorage.setItem('apna_demo_user', JSON.stringify(mockUser));
    localStorage.setItem('apna_demo_profile', JSON.stringify(mockProfile));

    try {
      const userRef = doc(db, 'users', mockUid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, mockProfile);
        setProfile(mockProfile);
        localStorage.setItem(`apna_profile_${mockUid}`, JSON.stringify(mockProfile));
      } else {
        const existingProf = docSnap.data() as UserProfile;
        setProfile(existingProf);
        localStorage.setItem('apna_demo_profile', JSON.stringify(existingProf));
        localStorage.setItem(`apna_profile_${mockUid}`, JSON.stringify(existingProf));
      }
    } catch (err) {
      console.warn("Could not sync demo profile to Firestore (using local fallback only):", err);
      const cachedProfileStr = localStorage.getItem(`apna_profile_${mockUid}`);
      if (cachedProfileStr) {
        setProfile(JSON.parse(cachedProfileStr));
      } else {
        setProfile(mockProfile);
      }
    }

    setUser(mockUser);
  };

  const logout = async () => {
    localStorage.removeItem('apna_demo_user');
    localStorage.removeItem('apna_demo_profile');
    setUser(null);
    setProfile(null);
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Firebase signout skipped or failed:", e);
    }
  };

  const updateProfileData = async (updates: Partial<UserProfile>) => {
    const isDemo = localStorage.getItem('apna_demo_user') !== null;
    if (isDemo && profile) {
      const updatedProfile = { ...profile, ...updates };
      setProfile(updatedProfile);
      localStorage.setItem('apna_demo_profile', JSON.stringify(updatedProfile));
      localStorage.setItem(`apna_profile_${profile.uid}`, JSON.stringify(updatedProfile));
      
      try {
        const userRef = doc(db, 'users', profile.uid);
        await setDoc(userRef, updates, { merge: true });
      } catch (err) {
        console.warn("Could not sync updated demo profile to firestore:", err);
      }
      return;
    }

    if (profile) {
      const updatedProfile = { ...profile, ...updates };
      setProfile(updatedProfile);
      localStorage.setItem(`apna_profile_${profile.uid}`, JSON.stringify(updatedProfile));
    }

    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, updates, { merge: true });
    } catch (err) {
      console.warn("Could not sync updated profile to Firestore:", err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      loginWithEmail,
      registerWithEmail,
      loginWithGoogle,
      loginWithDemo,
      logout,
      updateProfileData
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
