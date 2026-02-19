import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB-waqgruomLZWmrY9K1bM_tvQ3cbgm8Zo",
    authDomain: "pesos-ef769.firebaseapp.com",
    projectId: "pesos-ef769",
    storageBucket: "pesos-ef769.firebasestorage.app",
    messagingSenderId: "589069109754",
    appId: "1:589069109754:web:8503f1e5dee698d1a03c43",
    measurementId: "G-4JH58E68XX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
