const fs = require('fs');
const lines = fs.readFileSync('C:/Users/crist/OneDrive/Documents/GitHub/coffebar-inventario-actualizado/mi-inventario/src/App.jsx', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('excel')) {
    console.log('Line ' + (i+1) + ': ' + l.trim());
  }
});
