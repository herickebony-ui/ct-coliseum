// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// IMPORTANTE: Substitua isso pelos dados do seu Console do Firebase depois!
const firebaseConfig = {
    apiKey: "AIzaSyA_RfvAjp85p-Z2dLn8OrqqdCSGYL4_bw8",
    authDomain: "coliseum-pre-venda.firebaseapp.com",
    projectId: "coliseum-pre-venda",
    storageBucket: "coliseum-pre-venda.firebasestorage.app",
    messagingSenderId: "836244641599",
    appId: "1:836244641599:web:29813e2d936a6596b1658a",
    measurementId: "G-MGYWJL97TY"
  };

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const db = getFirestore(app);
export const auth = getAuth(app);