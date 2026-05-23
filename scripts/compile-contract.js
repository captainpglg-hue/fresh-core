// Compile FreshCoreAnchor.sol et affiche taille bytecode + ABI.
// Sortie : contracts/FreshCoreAnchor.json (artefact).
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const source = fs.readFileSync(path.join(__dirname, '..', 'contracts', 'FreshCoreAnchor.sol'), 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'FreshCoreAnchor.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors && output.errors.length > 0) {
  const fatal = output.errors.filter((e) => e.severity === 'error');
  if (fatal.length > 0) {
    console.error('ERREURS DE COMPILATION:');
    fatal.forEach((e) => console.error(e.formattedMessage));
    process.exit(1);
  }
  console.warn('Warnings:');
  output.errors.forEach((e) => console.warn('  -', e.severity, ':', e.message));
}

const contract = output.contracts['FreshCoreAnchor.sol']['FreshCoreAnchor'];
const bytecode = contract.evm.bytecode.object;
const abi = contract.abi;

console.log('✓ Compilation OK');
console.log('  Solc version :', solc.version());
console.log('  Bytecode size :', bytecode.length / 2, 'bytes');
console.log('  ABI entries :', abi.length, '(fonctions + events + errors)');
console.log('  Fonctions externes :', abi.filter((a) => a.type === 'function').map((a) => a.name).join(', '));
console.log('  Events :', abi.filter((a) => a.type === 'event').map((a) => a.name).join(', '));
console.log('  Errors :', abi.filter((a) => a.type === 'error').map((a) => a.name).join(', '));

const artifact = { abi, bytecode: '0x' + bytecode };
fs.writeFileSync(
  path.join(__dirname, '..', 'contracts', 'FreshCoreAnchor.json'),
  JSON.stringify(artifact, null, 2)
);
console.log('✓ Artefact écrit : contracts/FreshCoreAnchor.json');
