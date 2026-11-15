import http from 'node:http';
import fs from 'node:fs/promises';
import { timingSafeEqual, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groundExample, safeExampleForPrompt } from './feedback_guard.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const apiKey = process.env.OPENAI_API_KEY || '';
const pilotCode = process.env.PILOT_ACCESS_CODE || '';
const model = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';
const dailyLimit = Number(process.env.DAILY_REQUEST_LIMIT || 60);
const perIpLimit = Number(process.env.PER_IP_REQUEST_LIMIT || 20);
const maxAudioBytes = 6 * 1024 * 1024;
const tasks = Object.freeze({
  intro: 'You are meeting a new colleague. Introduce yourself and describe what you do.',
  help: 'You need help finding a classroom. Ask a staff member politely.',
  opinion: 'Do you prefer working from home or in an office? Explain why.',
  work: 'Describe a small problem you faced at work and how you handled it.',
  experience: 'Talk about something new you learned recently and why it was useful.'
});
const calls = new Map();
const contentTypes = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.ico':'image/x-icon'};
const dailyKey = () => new Date().toISOString().slice(0,10);
function send(res, status, value) {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(value));
}
function codeMatches(actual, expected) {
  if (!actual || !expected) return false;
  const a = createHash('sha256').update(String(actual)).digest();
  const b = createHash('sha256').update(String(expected)).digest();
  return timingSafeEqual(a,b);
}
function enforcePilot(req, res) {
  if (!apiKey || !pilotCode) { send(res,503,{error:'The pilot is not configured yet.'}); return false; }
  if (!codeMatches(req.headers['x-pilot-code'],pilotCode)) {send(res,401,{error:'Invalid pilot access code. Please use the code provided in Canvas.'});return false;}
  const day = dailyKey();
  for (const k of calls.keys()) if (!k.startsWith(day+':')) calls.delete(k);
  const remote = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim().slice(0,50);
  const totalKey = day+':all'; const userKey = day+':'+remote;
  if ((calls.get(totalKey)||0)>=dailyLimit || (calls.get(userKey)||0)>=perIpLimit) {send(res,429,{error:'The test limit has been reached. Please try later or contact the facilitator.'});return false;}
  calls.set(totalKey,(calls.get(totalKey)||0)+1);
  calls.set(userKey,(calls.get(userKey)||0)+1);
  return true;
}
async function body(req, limit) {
  let bytes=0;const chunks=[];
  for await(const chunk of req){bytes+=chunk.length;if(bytes>limit){const e=new Error('Request too large');e.status=413;throw e;}chunks.push(chunk);}
  return Buffer.concat(chunks);
}
async function openAI(url, options) {
  const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${apiKey}`,...(options.headers||{})},signal:AbortSignal.timeout(75000)});
  let data;try{data=await r.json();}catch{throw Object.assign(new Error('Unexpected response from AI service.'),{status:502});}
  if(!r.ok){console.error('OpenAI error status',r.status);throw Object.assign(new Error('AI service unavailable ('+r.status+'). Please try again later.'),{status:502});}
  return data;
}
async function transcribe(req,res) {
  const t=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
  const types={'audio/webm':['webm','audio/webm'],'audio/mp4':['mp4','audio/mp4'],'audio/mpeg':['mp3','audio/mpeg'],'audio/wav':['wav','audio/wav'],'audio/x-wav':['wav','audio/wav'],'audio/ogg':['ogg','audio/ogg'],'audio/x-m4a':['m4a','audio/mp4']};
  if(!types[t])return send(res,415,{error:'Unsupported recording format: '+t});
  const blob=await body(req,maxAudioBytes);
  if(blob.length<300)return send(res,400,{error:'Recording is too short.'});
  const form=new FormData();form.append('model','whisper-1');form.append('language','en');
  form.append('file',new Blob([blob],{type:types[t][1]}),'speaking.'+types[t][0]);
  const result=await openAI('https://api.openai.com/v1/audio/transcriptions',{method:'POST',body:form});
  return send(res,200,{text:String(result.text||'').slice(0,3000)});
}
async function feedback(req,res){
  let data;try{data=JSON.parse((await body(req,12000)).toString('utf8'));}catch{return send(res,400,{error:'Invalid request.'});}
  const task=tasks[data.taskId];const transcript=String(data.transcript||'').trim().slice(0,3000);
  if(!task||!transcript)return send(res,400,{error:'Choose a task and record an answer first.'});
  const instructions=`You are a supportive English speaking practice tutor for adult English-as-a-second-language learners. You only have TEXT transcription; do not make claims about vocal tone, pronunciation, accent or voice characteristics. Never invent learners' jobs, names, opinions, motivations, employers, experiences, or other facts. Do not replace a learner's real opinion with your own. If the answer is off topic, note this briefly and guide them to retry rather than completing the task for them. Preserve original meaning. Give one evidence-based strength (not empty praise), up to two short practical suggestions, and an improved example grounded in their exact information. For missing details, use [bracketed placeholders]. Respond ONLY as JSON with keys: strength (string), suggestions (array 1-2 strings), improvedExample (string), onTopic (boolean). Keep language plain and encouraging.`;
  const result=await openAI('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,response_format:{type:'json_object'},messages:[{role:'system',content:instructions},{role:'user',content:`Speaking task: ${task}\nLearner said: ${transcript}`}]})});
  let f;try{f=JSON.parse(result.choices?.[0]?.message?.content||'{}');}catch{throw Object.assign(new Error('Could not read feedback.'),{status:502});}
  if(typeof f.strength!=='string'||!Array.isArray(f.suggestions)||typeof f.improvedExample!=='string')throw Object.assign(new Error('Feedback format error.'),{status:502});
  // The deterministic guard is inherited from Bazi Speak v0.3. It is not a
  // guarantee that every invented idea or personal detail will be caught.
  const improved=f.onTopic===false?safeExampleForPrompt(task,transcript):groundExample(task,transcript,f.improvedExample).example;
  return send(res,200,{strength:f.strength.slice(0,500),suggestions:f.suggestions.filter(v=>typeof v==='string').slice(0,2).map(v=>v.slice(0,400)),improvedExample:String(improved).slice(0,1200),onTopic:f.onTopic!==false});
}
async function staticFile(res, pathname){
  const filename=pathname==='/'?'index.html':pathname.slice(1);
  if(!['index.html','app.js','style.css','favicon.ico'].includes(filename))return send(res,404,{error:'Not found'});
  try{
    const content=await fs.readFile(path.join(here,'public',filename));
    res.writeHead(200,{'content-type':contentTypes[path.extname(filename)]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'self' blob:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"});res.end(content);
  }catch{return send(res,404,{error:'Not found'});}
}
http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,`http://${host}:${port}`).pathname;
  if(req.method==='GET'&&pathname==='/health')return send(res,200,{status:'ok',version:'web-pilot-0.4',configured:Boolean(apiKey&&pilotCode)});
  if(req.method==='GET')return await staticFile(res,pathname);
  if(req.method==='POST'&&pathname==='/api/transcribe'){if(!enforcePilot(req,res))return;return await transcribe(req,res);}
  if(req.method==='POST'&&pathname==='/api/feedback'){if(!enforcePilot(req,res))return;return await feedback(req,res);}
  return send(res,404,{error:'Unknown endpoint'});
 }catch(e){console.error('Request error:',e?.message);return send(res,e?.status||500,{error:String(e?.status?e.message:'Request failed. Please try again.').slice(0,160)});}
}).listen(port,host,()=>console.log(`Bazi Speak Web Pilot listening on ${host}:${port}. API key and access code ${apiKey&&pilotCode?'configured':'not yet configured'}.`));
