import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const files = walkSync(modulesDir);
let totalChanged = 0;

// Known ID fields that are sometimes just typed as string
const idFields = ['manager', 'department', 'type', 'project', 'client', 'material', 'equipment', 'category', 'unit', 'role', 'user'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace type: string with format: objectId if description mentions ID
  content = content.replace(/(type:\s*string\s*\n\s+description:\s*.*?ID.*\b)/gi, "$1\n *                 format: objectId");

  // Also replace known fields like manager: \n type: string
  // Regex to find:   field: \n type: string without format: objectId
  for (const field of idFields) {
    const regex = new RegExp(`(\\b${field}:\\s*\\n\\s*\\*\\s*type:\\s*string)(?!\\s*\\n\\s*\\*\\s*format:\\s*objectId)`, 'gi');
    content = content.replace(regex, `$1\n *                 format: objectId\n *                 description: MongoDB ObjectId for ${field}`);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalChanged++;
    console.log(`Updated Swagger in: ${path.basename(file)}`);
  }
}

console.log(`Finished updating swagger docs in ${totalChanged} files.`);
