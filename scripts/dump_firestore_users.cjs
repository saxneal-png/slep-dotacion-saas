const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDqVdTHaB886PG9yWxAoaFTkqu10MUN58g",
  authDomain: "dotacionslep.firebaseapp.com",
  projectId: "dotacionslep",
  storageBucket: "dotacionslep.firebasestorage.app",
  messagingSenderId: "1042724678573",
  appId: "1:1042724678573:web:f1d25eec38fe513bdf0f24"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function dumpFirestoreUsers() {
  const snap = await getDocs(collection(db, 'usuarios'));
  console.log(`Encontrados ${snap.docs.length} usuarios en Firestore:`);
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(users.slice(0, 10));
  const fs = require('fs');
  fs.writeFileSync('database/firestore_users_dump.json', JSON.stringify(users, null, 2));
  console.log('Guardado en database/firestore_users_dump.json');
}

dumpFirestoreUsers().catch(console.error);
