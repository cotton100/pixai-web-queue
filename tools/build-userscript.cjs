'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'pixai-web-queue.user.js');
const readSource=name=>fs.readFileSync(name,'utf8').replace(/\r\n/g,'\n');
const original=readSource(file);let text=original;
const license=`  // BEGIN GPL LICENSE\n/*\nPixAI web queue browser port, modified 2026-10-13 by cotton100.\nAdapted from PixaiClackHelper (cotton100), based on NAIS3 (sunanakgo).\nThis program is free software under GPL version 3, WITHOUT ANY WARRANTY.\n${readSource(path.join(root,'LICENSE')).trim()}\n*/\n  // END GPL LICENSE`;
const licenseMarker=/  \/\/ BEGIN GPL LICENSE[\s\S]*?  \/\/ END GPL LICENSE/;
text=licenseMarker.test(text)?text.replace(licenseMarker,()=>license):text.replace("  'use strict';",()=>"  'use strict';\n"+license);
for(const [marker,name] of [['PARITY CORE','parity-core.js'],['IMAGE INFO','image-info.js'],['PARITY UI','parity-ui.js']]) {
  const input=path.join(root,'modules',name);if(!fs.existsSync(input))continue;
  const block=`  // BEGIN ${marker}\n${readSource(input).trim()}\n  // END ${marker}`;
  const expression=new RegExp(`  // BEGIN ${marker}[\\s\\S]*?  // END ${marker}`);
  text=expression.test(text)?text.replace(expression,()=>block):text.replace("  'use strict';",()=>"  'use strict';\n"+block);
}
if(process.argv.includes('--check')) {if(text!==original)throw new Error('Bundled userscript is stale: run node tools/build-userscript.cjs');}
else fs.writeFileSync(file,text);
