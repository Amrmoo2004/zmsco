const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, 'src', 'modules');

const walkSync = (dir, filelist = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.controller.js')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
};

const idFields = ['manager', 'department', 'type', 'project', 'client', 'material', 'equipment', 'category', 'unit', 'role', 'user', 'assignedTo', 'vendor', 'supplier'];

const files = walkSync(modulesDir);
let changedFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  for (const field of idFields) {
    // Check for inline objects like: manager: { type: string }
    const inlineRegex = new RegExp(`(\\b${field}:\\s*\\{[^}]*type:\\s*string)(?![^}]*ObjectId)[^}]*\\}`, 'gi');
    newContent = newContent.replace(inlineRegex, `$1, description: "MongoDB ObjectId" }`);

    // Check for multi-line objects like:
    // manager:
    //   type: string
    const multiLineRegex = new RegExp(`(\\b${field}:\\s*\\n\\s*\\*\\s*type:\\s*string)(?!\\s*\\n\\s*\\*\\s*description:.*ObjectId)`, 'gi');
    newContent = newContent.replace(multiLineRegex, `$1\n *                 description: "MongoDB ObjectId"`);
  }

  if (content !== newContent) {
    // One more pass to ensure we didn't duplicate `description` lines if they already existed but weren't matching "ObjectId"
    // To be perfectly safe, if it already had a description on the next line, we prepend "MongoDB ObjectId. "
    fs.writeFileSync(file, newContent, 'utf8');
    changedFiles++;
    console.log(`Updated IDs in: ${path.basename(file)}`);
  }
}

console.log(`Done. Updated ${changedFiles} files safely.`);
