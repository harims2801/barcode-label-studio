const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.existsSync(path.join(__dirname, 'dist/app.js')) ? 'dist' : 'src';
const read = name => fs.readFileSync(path.join(__dirname, source, name), 'utf8');
let html = read('index.html');
let app = read('app.js');
const template = fs.readFileSync(path.join(__dirname, source, 'Word_Label_Template.docx')).toString('base64');
const original = `    const response = await fetch("Word_Label_Template.docx");
    if (!response.ok) throw new Error("The Word label template could not be loaded.");
    const zip = await JSZip.loadAsync(await response.arrayBuffer());`;
if (!app.includes(original)) throw new Error('Template loader changed.');
app = app.replace(original, `    const zip = await JSZip.loadAsync(${JSON.stringify(template)}, { base64: true });`);
const logo = fs.readFileSync(path.join(__dirname, source, 'logo.png')).toString('base64');
const renderer = read('label-renderer.js').replace("logo.src = 'logo.png';", `logo.src = 'data:image/png;base64,${logo}';`);
const script = text => '<script>\n' + text.replace(/<\/script/gi, '<\\/script') + '\n</script>';
for (const [name, code] of [['jszip.min.js',read('jszip.min.js')],['label-renderer.js',renderer],['app.js',app]]) {
  new vm.Script(code);
  html = html.replace(`<script src="${name}"></script>`, () => script(code));
}
html = html.replace('<link rel="stylesheet" href="styles.css" />', () => '<style>\n' + read('styles.css') + '\n</style>');
if (/<script[^>]+src=|fetch\(/i.test(html)) throw new Error('External runtime reference remains.');
fs.writeFileSync(path.join(__dirname,'index.html'), html);
console.log(`Built standalone index.html (${html.length} bytes)`);
