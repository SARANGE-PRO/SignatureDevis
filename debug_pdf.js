const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function extractItems() {
    const data = new Uint8Array(fs.readFileSync('TESTDEVIS.PDF'));
    const pdf = await pdfjsLib.getDocument({ data: data }).promise;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items;

        for (let j = 0; j < items.length; j++) {
            if (items[j].str.includes('Mention') || items[j].str.includes('[')) {
                console.log(`Page ${i}, Item ${j}: "${items[j].str}" at X: ${items[j].transform[4]}, Y: ${items[j].transform[5]}`);
                for (let k = Math.max(0, j - 10); k < Math.min(items.length, j + 5); k++) {
                    console.log(`  [${k}]: "${items[k].str}" at X: ${items[k].transform[4]}, Y: ${items[k].transform[5]}`);
                }
            }
        }
    }
}

extractItems().catch(console.error);
