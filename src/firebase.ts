import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration loaded directly from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyCq5IEYYXPZbyBsN7pec-cPOhs72VWpdkk",
  authDomain: "fourth-cab-6qvh5.firebaseapp.com",
  projectId: "fourth-cab-6qvh5",
  storageBucket: "fourth-cab-6qvh5.firebasestorage.app",
  messagingSenderId: "736433066191",
  appId: "1:736433066191:web:dae828726dbf4db73067ba"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Ensure persistence is local so the session persists on page refresh
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Auth persistence error:", error);
});

export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut };
