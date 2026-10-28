const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  apiKey: 'AIzaSyDqVdTHaB886PG9yWxAoaFTkqu10MUN58g',
  authDomain: 'dotacionslep.firebaseapp.com',
  projectId: 'dotacionslep',
  storageBucket: 'dotacionslep.firebasestorage.app',
  messagingSenderId: '1042724678573',
  appId: '1:1042724678573:web:f1d25eec38fe513bdf0f24'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function sembrarColegios() {
  console.log('--- Iniciando siembra de los 121 colegios en Firebase Firestore ---');
  const catalogContent = fs.readFileSync('src/data/slepSchoolsCatalog.ts', 'utf8');
  const regex = /rbd:\s*'([^']+)',\s*nombre:\s*'([^']+)',\s*comuna:\s*'([^']+)',\s*tipo:\s*'([^']+)'(?:,\s*director:\s*'([^']+)')?/g;
  let match;
  const schools = [];
  while ((match = regex.exec(catalogContent)) !== null) {
    schools.push({
      rbd: match[1],
      nombre: match[2],
      comuna: match[3],
      tipo: match[4],
      director: match[5] || null,
      regimen: 'JEC',
      porcentajePrioritarios: 75
    });
  }

  console.log(`Detectados ${schools.length} colegios para subir.`);

  let exitosos = 0;
  for (const s of schools) {
    try {
      await setDoc(doc(db, 'establecimientos', s.rbd), s, { merge: true });
      exitosos++;
      if (exitosos % 20 === 0 || exitosos === schools.length) {
        console.log(`Sincronizados ${exitosos}/${schools.length} colegios en Firestore...`);
      }
    } catch (err) {
      console.error(`Error subiendo RBD ${s.rbd}:`, err.message);
      break;
    }
  }

  if (exitosos === schools.length) {
    console.log('✅ ¡Catálogo completo de colegios sembrado exitosamente en Firestore!');
  }
}

sembrarColegios();
