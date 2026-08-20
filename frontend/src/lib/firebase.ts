import { getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";

// Web config pública do Firebase (a proteção vem das Rules/backend, não da chave).
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyB3p0DvbtoDNI0WUPrly4PdLwmsbn_jNUU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "systematrix-apps.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "systematrix-apps",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:932627354123:web:f310c9babd17db8ac26d0e",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID ?? "932627354123",
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const microsoftProvider = new OAuthProvider("microsoft.com");
