const fs = require('fs');
const path = require('path');
const geojsonPath = path.join(__dirname, 'export.geojson');

if (!fs.existsSync(geojsonPath)) {
  console.error('❌ Error: export.geojson not found!');
  console.log('📁 Please place export.geojson in the scripts folder:');
  console.log('   ' + path.join(__dirname));
  process.exit(1);
}

const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
const neighborhoods = [];

geojson.features.forEach(feature => {

  if (feature.properties && feature.properties.place === 'suburb' && feature.geometry && feature.geometry.type === 'Polygon') {
    const name = feature.properties.name || 'Unknown';
    const id = name.toLowerCase()
      .replace(/ș/g, 's')
      .replace(/ț/g, 't')
      .replace(/ă/g, 'a')
      .replace(/â/g, 'a')
      .replace(/î/g, 'i')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    
    const coordinates = feature.geometry.coordinates[0].map(coord => ({
      latitude: coord[1],
      longitude: coord[0]
    }));
    
    neighborhoods.push({
      id,
      name,
      coordinates
    });
  }
});

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const outputPath = path.join(dataDir, 'neighborhoods.js');
const output = `export const neighborhoods = ${JSON.stringify(neighborhoods, null, 2)};`;
fs.writeFileSync(outputPath, output, 'utf8');

console.log(`Converted ${neighborhoods.length} neighborhoods:`);
neighborhoods.forEach(n => console.log(`   - ${n.name} (${n.coordinates.length} points)`));
console.log(`\n Output saved to: ${outputPath}`);