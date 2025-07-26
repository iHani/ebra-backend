const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, 'src');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            walk(fullPath, callback);
        } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.jsx')) {
            callback(fullPath);
        }
    });
}

function normalizeCommentPath(filePath) {
    const rel = path.relative(__dirname, filePath).replace(/\\/g, '/');
    return `// ${rel}`;
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const expectedComment = normalizeCommentPath(filePath);

    if (lines[0].trim() === expectedComment) {
        console.log(`[SKIP] ${filePath}`);
        return;
    }

    // Insert the path comment
    const updatedContent = [expectedComment, ...lines].join('\n');
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`[ADD]  ${filePath}`);
}

walk(rootDir, processFile);
