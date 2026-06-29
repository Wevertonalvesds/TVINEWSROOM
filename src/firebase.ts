import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, getDoc, setDoc, query, orderBy, serverTimestamp, where, onSnapshot } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User, updatePassword, setPersistence, browserSessionPersistence, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
});

// Initialize Firestore with custom database ID if specified
const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);

// Isolate sessions per browser tab/window
setPersistence(auth, browserSessionPersistence).catch(err => {
  console.error("Error setting tab-session persistence:", err);
});

// Initialize a secondary Firebase App for Google Drive authentication to prevent switching the primary user session
const secondaryAppName = 'rede-tvi-google-drive';
const googleApp = getApps().find(a => a.name === secondaryAppName) || initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
}, secondaryAppName);

export const googleAuth = getAuth(googleApp);

export { 
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, getDoc, setDoc, query, orderBy, serverTimestamp, where, onSnapshot,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential, type User
};
