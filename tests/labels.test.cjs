const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createCanvas, loadImage, GlobalFonts} = require('@napi-rs/canvas');
// Match the browser's sans-serif face in headless raster verification.
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf','Arial');
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf','Arial');
const root = path.resolve(__dirname,'..');
const src = fs.existsSync(path.join(root,'dist/app.js')) ? 'dist' : 'src';
const read = name => fs.readFileSync(path.join(root,src,name),'utf8');
const defaults = {shopFont:30,designsFont:16,taglineFont:11,logoOffset:0,pricePrefix:'Yes WE Price',brand:'Yeswedesigns',priceColor:'C00000',sizeColor:'008000',startPosition:1,rowsPerPage:4,barcodeWidthCm:3.75,barcodeHeightCm:1.25,nameFont:10.5,lineSpacing:1.15,labelsPerRow:4,labelWidthCm:4.8,labelHeightCm:6.9,horizontalGapCm:.18,verticalGapCm:.08,codeFont:8.5,sizeFont:7.5,priceFont:9,brandFont:8};
const p = {code:'005330',name:'FANCY COTTON SAREE',size:'XL',price:'1110'};
let api, renderer;
const init = (async () => {
  const logo = await loadImage(path.join(root,src,'logo.png'));
  const element = {addEventListener(){},value:'',innerHTML:''};
  const document = {querySelector:()=>element,createElement:()=>createCanvas(1,1)};
  const scope = {console,document,window:{},setTimeout,clearTimeout,setImmediate,Blob,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array,Promise,TextEncoder,TextDecoder,Buffer,logo,
    fetch:async()=>({ok:true,arrayBuffer:async()=>{const b=fs.readFileSync(path.join(root,src,'Word_Label_Template.docx'));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}})};
  vm.createContext(scope);
  vm.runInContext(read('jszip.min.js'),scope);
  scope.JSZip = scope.window.JSZip;
  vm.runInContext(read('label-renderer.js').replace(/  const logo = new Image\(\);[\s\S]*?  const ready = logo.decode\(\);/,'  const ready = Promise.resolve();'),scope);
  scope.LabelRenderer = scope.window.LabelRenderer;
  let app=read('app.js');
  app=app.slice(0,app.indexOf('  restoreLocalState();')) + '  window.testAPI = {code128Modules, barcodeCanvas, buildDocumentXml, createWordDocument};\n})();';
  vm.runInContext(app,scope);
  api=scope.window.testAPI;renderer=scope.LabelRenderer;
})();
test('branding, optional size and long names render at 600 dpi',async()=>{
  await init;
  for(const product of [p,{...p,size:''},{...p,name:'kanjivaram silk'}]){
    const canvas=renderer.render(product,defaults,api.barcodeCanvas);
    assert.equal(canvas.width,1134);assert.equal(canvas.height,1630);
  }
});
test('label has one outer border and one barcode-section border',async()=>{
  await init;
  const canvas=renderer.render(p,defaults,api.barcodeCanvas),ctx=canvas.getContext('2d'),px=600/25.4;
  const isDark=(x,y)=>{const d=ctx.getImageData(Math.round(x*px),Math.round(y*px),1,1).data;return d[0]<80&&d[1]<80&&d[2]<80;};
  assert.ok(isDark(.35,15),'outer border');
  assert.ok(isDark(2,35),'barcode-section border');
  assert.equal(isDark(2.8,35),false,'no duplicate inner border');
});
test('content closes gaps while barcode size and outer label stay fixed',async()=>{
  await init;
  const compact=renderer.render({...p,name:'silk',size:''},defaults,api.barcodeCanvas);
  const nameWrap=renderer.render({...p,name:'FANCY COTTON SAREE',size:''},defaults,api.barcodeCanvas);
  const withSize=renderer.render({...p,name:'silk',size:'XL'},defaults,api.barcodeCanvas);
  assert.equal(compact.width,nameWrap.width);assert.equal(compact.height,nameWrap.height);
  assert.equal(compact.labelLayout.barcodeH,nameWrap.labelLayout.barcodeH);
  assert.equal(compact.labelLayout.barcodeW,nameWrap.labelLayout.barcodeW);
  assert.equal(nameWrap.labelLayout.nameLines,2);
  assert.ok(nameWrap.labelLayout.barcodeY>compact.labelLayout.barcodeY);
  assert.ok(withSize.labelLayout.panelBottom>compact.labelLayout.panelBottom);
  assert.ok(withSize.labelLayout.outerBottom>compact.labelLayout.outerBottom);
  assert.equal(compact.labelLayout.outerBottom,compact.labelLayout.panelBottom+.8);
  const pos=withSize.labelLayout.detailPositions;
  assert.ok(pos.size-pos.code<defaults.codeFont*(25.4/72)*defaults.lineSpacing,'Size moves into the unused code gap');
  assert.ok(pos.price-pos.size>defaults.sizeFont*(25.4/72)*1.25,'Price remains clear of Size');
});
test('logo position changes only watermark, barcode pixels unchanged',async()=>{
  await init;
  const a=renderer.render(p,defaults,api.barcodeCanvas),b=renderer.render(p,{...defaults,logoOffset:20},api.barcodeCanvas);
  assert.notDeepEqual(a.toBuffer('image/png'),b.toBuffer('image/png'));
  const px=600/25.4;
  const region=c=>c.getContext('2d').getImageData(Math.ceil(7*px),Math.ceil(43.1*px),Math.floor(35*px),Math.floor(12*px)).data;
  assert.deepEqual(region(a),region(b));
});
test('font and colours independently change rendered output',async()=>{
  await init;
  const original=renderer.render(p,defaults,api.barcodeCanvas).toBuffer('image/png');
  for(const [key,value] of [['shopFont',26],['designsFont',14],['taglineFont',10],['nameFont',9.5],['priceColor','0000FF'],['sizeColor','FF0000']]){
    assert.notDeepEqual(original,renderer.render(p,{...defaults,[key]:value},api.barcodeCanvas).toBuffer('image/png'),key);
  }
});
test('overflows are rejected instead of clipped',async()=>{
  await init;
  assert.throws(()=>renderer.render({...p,name:'A'.repeat(80)},defaults,api.barcodeCanvas),/too wide/);
  assert.throws(()=>renderer.render(p,{...defaults,barcodeHeightCm:2},api.barcodeCanvas),/too tall/);
  assert.throws(()=>renderer.render(p,{...defaults,designsFont:24},api.barcodeCanvas),/too wide|too tall/);
});
test('Code128 leading zeroes, checksum, quiet zones and different codes',async()=>{
  await init;
  const modules=api.code128Modules('005330');
  assert.ok(modules.startsWith('0'.repeat(10)));assert.ok(modules.endsWith('0'.repeat(10)));
  assert.notEqual(modules,api.code128Modules('5330'));
  assert.equal(modules.length,88);
});
test('two-page DOCX with start offset, distinct products sharing code',async()=>{
  await init;
  const labels=Array.from({length:20},(_,i)=>({...p,size:i%2?'':'XL',price:String(500+i)}));
  const s={...defaults,startPosition:2};
  const {xml,images}=api.buildDocumentXml(labels,s);
  assert.equal((xml.match(/<w:tbl>/g)||[]).length,2);assert.equal(images.length,20);
  assert.ok(xml.includes('cx="1728000" cy="2484000"'));
  assert.ok(xml.includes('w:pgMar w:top="510" w:right="357" w:bottom="510" w:left="357"'));
  // napi canvas supplies toBlob; return its PNG bytes through the browser-shaped API.
  const canvasProto=Object.getPrototypeOf(createCanvas(1,1));
  canvasProto.toBlob=function(callback){callback(new Blob([this.toBuffer('image/png')],{type:'image/png'}));};
  const blob=await api.createWordDocument(labels,s);
  assert.ok(blob.size>10000);
  fs.mkdirSync(path.join(root,'qa'),{recursive:true});
  fs.writeFileSync(path.join(root,'qa/two-pages.docx'),Buffer.from(await blob.arrayBuffer()));
  fs.writeFileSync(path.join(root,'qa/label.png'),renderer.render(p,defaults,api.barcodeCanvas).toBuffer('image/png'));
});
