import { existsSync } from 'node:fs';
export default { root: existsSync('dist/app.js') ? 'dist' : 'src', server: { allowedHosts: ['terminal.local'] } };
