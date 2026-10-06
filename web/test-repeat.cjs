const { chromium } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const ctx = await browser.newContext({baseURL:'https://147.15.89.156'});
 await ctx.request.get('/api/session');
 const prior = JSON.parse(fs.readFileSync('test-results/llm-primeira-4b.json','utf8'));
 const response=await ctx.request.post('/api/jobs',{data:{input:prior.input,mode:'llm'}});
 if(response.status()!==202) throw Error(await response.text());
 const job=await response.json();
 let current;
 for(let n=0;n<80;n++) {
  await new Promise(r=>setTimeout(r,5000));
  current=await (await ctx.request.get(`/api/jobs/${job.id}`)).json();
  if(current.status!=='running') break;
 }
 if(current.status!=='done') throw Error(JSON.stringify(current));
 const before=prior.result.plano.recomendacoes.map(p=>[p.competencia_id,p.decisao,p.acao_id]);
 const after=current.result.plano.recomendacoes.map(p=>[p.competencia_id,p.decisao,p.acao_id]);
 if(JSON.stringify(before)!==JSON.stringify(after)) throw Error('Escolhas divergiram na repeticao.');
 fs.writeFileSync('test-results/llm-repeticao-4b.json',JSON.stringify(current,null,2));
 console.log(JSON.stringify({seconds:current.result.metadados.tempo_segundos,sameActions:true,sameJustifications:JSON.stringify(prior.result.plano.recomendacoes)===JSON.stringify(current.result.plano.recomendacoes)}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
