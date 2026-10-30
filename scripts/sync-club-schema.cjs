const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'supabase/schema.sql');
const marker = '-- BEGIN GENERATED CLUB REQUESTS MIGRATION';
let base = fs.readFileSync(target, 'utf8').split(marker)[0].trimEnd();
if (!base.includes('set check_function_bodies = off;')) {
  base = 'set check_function_bodies = off;\ncreate schema if not exists extensions;\n\n' + base;
}
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261027_club_requests.sql'), 'utf8');
fs.writeFileSync(target, `${base}\n\n${marker}\n${migration}\n-- END GENERATED CLUB REQUESTS MIGRATION\nreset check_function_bodies;\n`);
console.log('Updated supabase/schema.sql from the migration.');
