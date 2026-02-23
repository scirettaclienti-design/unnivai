
const fs = require('fs');
const content = fs.readFileSync('/Users/mac2023ivanosciretta/unnivai ricresa/src/pages/MapPage.jsx', 'utf8');

const lines = content.split('\n');
let divStack = [];
let selfClosing = 0;

lines.forEach((line, index) => {
    // Match open divs (not self-closing)
    let openMatches = line.matchAll(/<div(?:\s+[^>]*[^/])?>/g);
    for (const match of openMatches) {
        divStack.push({ line: index + 1, content: line.trim() });
    }

    // Match self-closing divs
    let selfMatches = line.matchAll(/<div\s+[^>]*\/>/g);
    for (const match of selfMatches) {
        selfClosing++;
    }

    // Match closing divs
    let closeMatches = line.matchAll(/<\/div>/g);
    for (const match of closeMatches) {
        if (divStack.length > 0) {
            divStack.pop();
        } else {
            console.log(`Extra closing div at line ${index + 1}: ${line.trim()}`);
        }
    }
});

console.log(`Final stack size: ${divStack.length}`);
divStack.forEach(item => {
    console.log(`Unclosed div at line ${item.line}: ${item.content}`);
});
console.log(`Total self-closing: ${selfClosing}`);
