const fs = require('fs');

const srcPath = 'C:/Users/crist/OneDrive/Documents/GitHub/coffebar-inventario-actualizado/mi-inventario/src/App.jsx';
const destPath = 'src/App.jsx';

let code = fs.readFileSync(srcPath, 'utf8');

// 1. Replace Firebase config
const newFirebaseConfig = `const firebaseConfig = {
  apiKey: "AIza" + "SyAuBPW0xsIVclFMr1OURPzAPrvSPD9wyv4",
  authDomain: "inventario-de-repuestos-taller.firebaseapp.com",
  projectId: "inventario-de-repuestos-taller",
  storageBucket: "inventario-de-repuestos-taller.firebasestorage.app",
  messagingSenderId: "974025120647",
  appId: "1:974025120647:web:e4ac47ed91438e74bc9122",
  measurementId: "G-8SLD789ME0"
};`;

code = code.replace(/const firebaseConfig = \{[\s\S]*?\};/, newFirebaseConfig);

// 2. Remove handleImportarExcel function
// Finding the block: starts at `const handleImportarExcel = async (e) => {`
// and ends before `const exportarExcel = async`
code = code.replace(/const handleImportarExcel = async \(e\) => \{[\s\S]*?const exportarExcel = async/g, 'const exportarExcel = async');

// 3. Remove the UI block for importing Excel
// We will look for the `<div className="mb-6"><h3 className="text-lg font-bold text-white">Carga de Datos</h3>` block
code = code.replace(/<div className="mb-6"><h3 className="text-lg font-bold text-white">Carga de Datos<\/h3>[\s\S]*?<button onClick=\{descargarPlantillaExcel\}[\s\S]*?<\/button>\s*<\/div>/, '');
// Also the `descargarPlantillaExcel` function
code = code.replace(/const descargarPlantillaExcel = async \(\) => \{[\s\S]*?\}\s*;/g, '');

fs.writeFileSync(destPath, code);
console.log('Migration successful');
