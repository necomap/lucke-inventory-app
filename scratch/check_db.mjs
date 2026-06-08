import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDXVQlkZMgxX9e7Jz0nW0bI8-7WuYRiMM4",
  authDomain: "lucke-inventory-app.firebaseapp.com",
  projectId: "lucke-inventory-app",
  storageBucket: "lucke-inventory-app.firebasestorage.app",
  messagingSenderId: "751485181986",
  appId: "1:751485181986:web:5db059e34f33b25d442a7b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  try {
    const querySnapshot = await getDocs(collection(db, 'items'));
    console.log(`Total items in DB: ${querySnapshot.size}`);
    const userIds = new Set();
    querySnapshot.forEach(doc => {
      const data = doc.data();
      userIds.add(data.userId || 'undefined');
    });
    console.log("Distinct userIds in DB:", Array.from(userIds));
  } catch (err) {
    console.error("Error reading items:", err);
  }
}

check();
