import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD-B0ZmB9xg7ert60bxeJZb-9P2eL4HLE0",
  authDomain: "ai-tutor-ef427.firebaseapp.com",
  projectId: "ai-tutor-ef427",
  storageBucket: "ai-tutor-ef427.firebasestorage.app",
  messagingSenderId: "793265759189",
  appId: "1:793265759189:web:23096fc20aca15828d535c",
  measurementId: "G-3CGPL4CP58"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);