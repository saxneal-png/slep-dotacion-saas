const fs = require('fs');
const content = fs.readFileSync('src/data/slepSchoolsCatalog.ts', 'utf8');

// Match school objects in TypeScript catalog
const regex = /rbd:\s*'([^']+)',\s*nombre:\s*'([^']+)',\s*comuna:\s*'([^']+)',\s*tipo:\s*'([^']+)'(?:,\s*director:\s*'([^']+)')?/g;
let match;
const schools = [];
while ((match = regex.exec(content)) !== null) {
  schools.push({
    rbd: match[1],
    nombre: match[2].replace(/'/g, "''"),
    comuna: match[3].replace(/'/g, "''"),
    tipo: match[4],
    director: match[5] ? match[5].replace(/'/g, "''") : null
  });
}

console.log('Total colegios extraidos:', schools.length);

let sql = '-- ==============================================================\n';
sql += '-- Catálogo Maestro Oficial SLEP Valle Diguillín (121 Establecimientos)\n';
sql += '-- ==============================================================\n\n';
sql += 'INSERT INTO establecimientos (rbd, nombre, comuna, tipo, director, regimen, porcentaje_prioritarios) VALUES\n';

const lines = schools.map(s => {
  const dir = s.director ? `'${s.director}'` : 'NULL';
  return `('${s.rbd}', '${s.nombre}', '${s.comuna}', '${s.tipo}', ${dir}, 'JEC', 75.00)`;
});

sql += lines.join(',\n') + '\nON DUPLICATE KEY UPDATE nombre=VALUES(nombre), comuna=VALUES(comuna), tipo=VALUES(tipo), director=COALESCE(VALUES(director), director);\n\n';

// Usuarios de prueba iniciales (clave: admin123 para todos de prueba)
// Hash generado con PHP password_hash('admin123', PASSWORD_BCRYPT)
sql += '-- ==============================================================\n';
sql += '-- Usuarios de Prueba Iniciales (Password: admin123)\n';
sql += '-- ==============================================================\n';
sql += 'INSERT INTO usuarios (id, run, email, password_hash, nombre_completo, rol, rbd_asignado) VALUES\n';
sql += `(1, '11111111-1', 'admin@slepvallediguillin.cl', '$2y$10$wTf2zG.Rslp8lG8uYQd3leGk5r4vD7z/V6G90X7N1k1bEaP2q9q6G', 'Administrador General SLEP', 'ADMIN', NULL),\n`;
sql += `(2, '22222222-2', 'asesor.uatp@slepvallediguillin.cl', '$2y$10$wTf2zG.Rslp8lG8uYQd3leGk5r4vD7z/V6G90X7N1k1bEaP2q9q6G', 'Asesor UATP Territorial', 'ASESOR_UATP', NULL),\n`;
sql += `(3, '33333333-3', 'director.3656@slepvallediguillin.cl', '$2y$10$wTf2zG.Rslp8lG8uYQd3leGk5r4vD7z/V6G90X7N1k1bEaP2q9q6G', 'Directora Verónica Knothe Badillo', 'DIRECTOR', '3656')\n`;
sql += 'ON DUPLICATE KEY UPDATE nombre_completo=VALUES(nombre_completo);\n\n';

// Cartera de prueba para el Asesor UATP
sql += '-- Cartera territorial para el Asesor UATP (Liceo Pacheco Altamirano, Marta Brunet, Narciso Tondreau, Ruiz de Gamboa)\n';
sql += `INSERT IGNORE INTO asesor_cartera (usuario_id, rbd) VALUES (2, '3656'), (2, '3638'), (2, '3639'), (2, '3643');\n`;

fs.writeFileSync('database/seed_121_colegios.sql', sql, 'utf8');
console.log('Archivo database/seed_121_colegios.sql generado con éxito.');
