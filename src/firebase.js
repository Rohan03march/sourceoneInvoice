import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBSRNso3SgMuUTNWUVnlYqS9COv7DtfLfI",
  authDomain: "sourceoneinvoice.firebaseapp.com",
  projectId: "sourceoneinvoice",
  storageBucket: "sourceoneinvoice.firebasestorage.app",
  messagingSenderId: "245644133915",
  appId: "1:245644133915:web:c7a7d1554a5f79142b9abe",
  measurementId: "G-KP6EN04F72"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
