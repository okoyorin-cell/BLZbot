const { toolsDeclaration } = require('./tools.js');

console.log(`=== Tool Declaration Validation ===\n`);
console.log(`Total tools declared: ${toolsDeclaration.length}\n`);

let hasErrors = false;

toolsDeclaration.forEach((tool, index) => {
    const errors = [];

    // Check required fields
    if (!tool.name) errors.push('Missing "name"');
    if (!tool.description) errors.push('Missing "description"');
    if (!tool.parameters) errors.push('Missing "parameters"');

    // Check parameters structure
    if (tool.parameters) {
        if (tool.parameters.type !== 'object') {
            errors.push(`parameters.type should be "object", got "${tool.parameters.type}"`);
        }
        if (!tool.parameters.properties) {
            errors.push('Missing "parameters.properties"');
        }
    }

    if (errors.length > 0) {
        hasErrors = true;
        console.log(`❌ Tool ${index + 1}: ${tool.name || 'UNNAMED'}`);
        errors.forEach(err => console.log(`   - ${err}`));
        console.log('');
    }
});

const { toolsImplementation } = require('./tools.js');
console.log(`\n=== Tool Implementation Validation ===`);
console.log(`Total implementations: ${Object.keys(toolsImplementation).length}`);

toolsDeclaration.forEach(tool => {
    if (!toolsImplementation[tool.name]) {
        console.log(`❌ Missing implementation for tool: ${tool.name}`);
        hasErrors = true;
    }
});

if (!hasErrors) {
    console.log('\n✅ All tool declarations AND implementations are valid!\n');
    console.log('Sample tool structure:');
    console.log(JSON.stringify(toolsDeclaration[0], null, 2));
} else {
    console.log('\n⚠️ Some tools have validation errors. Fix them before deploying.');
    process.exit(1);
}
