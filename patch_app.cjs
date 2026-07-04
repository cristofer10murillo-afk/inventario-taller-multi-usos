const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const newConfig = `{
  apiKey: "AIzaSyAuBPW0xsIVclFMr1OURPzAPrvSPD9wyv4",
  authDomain: "inventario-de-repuestos-taller.firebaseapp.com",
  projectId: "inventario-de-repuestos-taller",
  storageBucket: "inventario-de-repuestos-taller.firebasestorage.app",
  messagingSenderId: "974025120647",
  appId: "1:974025120647:web:e4ac47ed91438e74bc9122",
  measurementId: "G-8SLD789ME0"
}`;

code = code.replace(/\{[\s\n]*apiKey: "AIzaSyDoGUxK2uNrPAeuZSPtVSrQhK8sEw1iu3o"[\s\S]*?\}/, newConfig);

code = code.replace(/Cristopher/g, 'Cristofer');
code = code.replace(/cristopher/g, 'cristofer');

fs.writeFileSync('src/App.jsx', code);
console.log('App.jsx patched successfully!');
