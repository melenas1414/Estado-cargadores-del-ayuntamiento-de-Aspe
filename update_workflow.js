const fs = require('fs');
const path = require('path');

const workflowPath = 'scripts/n8n/iberdrola-supabase-workflow.json';
const codePath = 'scripts/n8n/iberdrola-supabase.code.js';

try {
  const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  const code = fs.readFileSync(codePath, 'utf8');

  let scrapeNodeUpdated = false;
  let configNodeUpdated = false;

  workflow.nodes.forEach(node => {
    if (node.name === 'Scrape + Insert Supabase') {
      node.parameters.jsCode = code;
      scrapeNodeUpdated = true;
    }

    if (node.name === 'Configuracion') {
      const assignments = node.parameters.assignments.assignments;
      
      // Update incrementalLatMax
      const latMax = assignments.find(a => a.id === 'incrementalLatMax' || a.name === 'incrementalLatMax');
      if (latMax) {
        latMax.value = 38.41;
      }

      // Update incrementalLonMax
      const lonMax = assignments.find(a => a.id === 'incrementalLonMax' || a.name === 'incrementalLonMax');
      if (lonMax) {
        lonMax.value = -0.72;
      }

      // Add or update scraperStationIds
      const stationIds = assignments.find(a => a.id === 'scraperStationIds' || a.name === 'scraperStationIds');
      const stationIdsValue = 'ESIBE22E0001001,ESIBE22E0001002,ESIBE22E0001003,ESIBE22E0001004,ESIBE22E0001005,IBERDROLA-5629';
      if (stationIds) {
        stationIds.value = stationIdsValue;
      } else {
        assignments.push({
          id: 'scraperStationIds',
          name: 'scraperStationIds',
          type: 'string',
          value: stationIdsValue
        });
      }
      configNodeUpdated = true;
    }
  });

  fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf8');

  console.log('Update Summary:');
  console.log(`- Node "Scrape + Insert Supabase": ${scrapeNodeUpdated ? 'Updated jsCode' : 'NOT FOUND'}`);
  console.log(`- Node "Configuracion": ${configNodeUpdated ? 'Updated assignments' : 'NOT FOUND'}`);
  if (configNodeUpdated) {
    console.log('  - incrementalLatMax -> 38.41');
    console.log('  - incrementalLonMax -> -0.72');
    console.log('  - scraperStationIds -> ESIBE22E0001001,ESIBE22E0001002,ESIBE22E0001003,ESIBE22E0001004,ESIBE22E0001005,IBERDROLA-5629');
  }

} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
