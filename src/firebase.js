import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword, // Новое: Регистрация
  signInWithEmailAndPassword,     // Новое: Вход
  sendPasswordResetEmail,         // Новое: Сброс пароля
  updateProfile                   // Новое: Обновление имени
} from "firebase/auth";
import { getFirestore,
enableIndexedDbPersistence, // Импортируем функцию оффлайна
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAU4-3U_-f9X4kDht2cV2ujyxLtv6xepQw",
  authDomain: "gymweb-ddbdd.firebaseapp.com",
  projectId: "gymweb-ddbdd",
  storageBucket: "gymweb-ddbdd.firebasestorage.app",
  messagingSenderId: "867541283248",
  appId: "1:867541283248:web:f7c26d7531f87abe482675",
  measurementId: "G-R7MZG7GCGT"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

// --- ВКЛЮЧАЕМ ОФФЛАЙН РЕЖИМ ---
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
      console.log('Оффлайн не работает: открыто слишком много вкладок');
  } else if (err.code == 'unimplemented') {
      console.log('Браузер не поддерживает оффлайн');
  }
});

// Экспортируем функции
export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const logout = () => signOut(auth);
export const logInWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const registerWithEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const sendPasswordReset = (email) => sendPasswordResetEmail(auth, email);
export const updateUserProfile = (user, name) => updateProfile(user, { displayName: name });