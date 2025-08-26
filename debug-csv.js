// Quick test of CSV parsing with European format
const testData = `Winkel;Force left;Force right;Total press force;Kanal LENKIMAS DS;Kanal LENKIMAS OS;Kanal TARP PUANSONU;Kanal ROUND PUNCH;OS DOUBLE;DS DOUBLE;PLOTIS OS;SLIDE
0,000;0,000;0,000;0,000;0,000;0,000;0,000;0,000;0,122;0,183;1999,939;0,244
0,100;0,000;0,000;0,000;0,000;0,000;0,000;0,000;0,000;0,122;1999,939;0,183
4,300;0,000;0,000;0,000;0,000;22,000;-22,000;-30,229;0,000;0,122;1999,939;0,183`;

function parseNumericValue(value) {
    if (!value || value.trim().length === 0) {
        return NaN;
    }

    const trimmed = value.trim();

    // Check if it might be European format (contains comma but no dot)
    if (trimmed.includes(',') && !trimmed.includes('.')) {
        // European format - replace comma with dot (1,234 -> 1.234)
        const europeanConverted = trimmed.replace(',', '.');
        const result = parseFloat(europeanConverted);
        if (Number.isFinite(result)) {
            return result;
        }
    }

    // Try standard parseFloat for US format (1.234) or if European conversion failed
    const result = parseFloat(trimmed);
    return result;
}

// Test parsing
console.log('Testing European number parsing:');
console.log('0,000 ->', parseNumericValue('0,000'));
console.log('22,000 ->', parseNumericValue('22,000'));
console.log('-30,229 ->', parseNumericValue('-30,229'));
console.log('1999,939 ->', parseNumericValue('1999,939'));

// Test delimiter detection
function detectDelimiter(line) {
    const delimiters = [',', '\t', ';', '|'];
    let maxCount = 0;
    let bestDelimiter = ',';

    for (const delimiter of delimiters) {
        const count = line.split(delimiter).length - 1;
        if (count > maxCount) {
            maxCount = count;
            bestDelimiter = delimiter;
        }
    }

    return bestDelimiter;
}

const lines = testData.split('\n');
console.log('\nDetected delimiter:', detectDelimiter(lines[0]));

// Test header detection
const firstLineCells = lines[0].split(';').map((cell) => cell.trim());
console.log('\nFirst line cells:', firstLineCells);

const hasHeader = firstLineCells.some((cell) => {
    const trimmed = cell.trim();
    if (trimmed.length === 0) return false;

    const num = parseNumericValue(trimmed);
    return !Number.isFinite(num);
});

console.log('Has header:', hasHeader);

// Test full parsing
const secondLineCells = lines[1].split(';').map((cell) => cell.trim());
console.log('\nSecond line parsed:');
secondLineCells.forEach((cell, i) => {
    const parsed = parseNumericValue(cell);
    console.log(`${firstLineCells[i]} (${cell}) -> ${parsed}`);
});
