const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sembrarColegios() {
  console.log('--- Subiendo colegios restantes a Firestore con pausas controladas ---');
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

  let subidos = 0;
  for (const s of schools) {
    let reintentos = 3;
    while (reintentos > 0) {
      try {
        await setDoc(doc(db, 'establecimientos', s.rbd), s, { merge: true });
        subidos++;
        if (subidos % 25 === 0 || subidos === schools.length) {
          console.log(`[Firestore] Sincronizados ${subidos}/${schools.length} colegios...`);
        }
        await sleep(50); // Pausa de 50ms para no saturar el canal de prueba
        break;
      } catch (err) {
        reintentos--;
        if (reintentos === 0) {
          console.error(`Fallo definitivo en RBD ${s.rbd}:`, err.message);
        } else {
          await sleep(500);
        }
      }
    }
  }

  console.log(`\n🎉 PROCESO FINALIZADO: ${subidos}/${schools.length} colegios activos en Firebase Firestore.`);
}

sembrarColegios();
