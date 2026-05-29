const fs = require('fs');
const path = require('path');

const workflowPath = 'scripts/n8n/iberdrola-supabase-workflow.json';
const codePath = 'scripts/n8n/iberdrola-supabase.code.js';

const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const code = fs.readFileSync(codePath, 'utf8');

// Update jsCode in "Scrape + Insert Supabase" node
const scrapeNode = workflow.nodes.find(n => n.name === "Scrape + Insert Supabase");
if (scrapeNode) {
    scrapeNode.parameters.jsCode = code;
} else {
    console.error('Node "Scrape + Insert Supabase" not found');
    process.exit(1);
}

// Update "Configuracion" node assignments
const configNode = workflow.nodes.find(n => n.name === "Configuracion");
if (configNode && configNode.parameters && configNode.parameters.assignments && configNode.parameters.assignments.assignments) {
    configNode.parameters.assignments.assignments.forEach(assignment => {
        if (assignment.id === "supabaseUrl" || assignment.name === "supabaseUrl") {
            assignment.value = "SUPABASE_URL_PLACEHOLDER";
        }
        if (assignment.id === "n8nNotifyWebhookUrl" || assignment.name === "n8nNotifyWebhookUrl") {
            assignment.value = "N8N_NOTIFY_WEBHOOK_URL_PLACEHOLDER";
        }
    });
} else {
    console.error('Node "Configuracion" or its assignments not found');
    process.exit(1);
}

fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2) + '\n');
console.log('Workflow updated successfully.');
