const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Update imports
code = code.replace(
  "import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';",
  "import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';"
);

// Update initialization
code = code.replace(
  "const db = getFirestore(app);",
  "const db = initializeFirestore(app, { localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()}) });"
);

fs.writeFileSync('src/App.jsx', code);
console.log("Persistence enabled");
