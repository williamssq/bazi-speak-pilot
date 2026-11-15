const $ = id => document.getElementById(id);
const prompts = {
 intro:'You are meeting a new colleague. Introduce yourself and describe what you do.',
 help:'You need help finding a classroom. Ask a staff member politely.',
 opinion:'Do you prefer working from home or in an office? Explain why.',
 work:'Describe a small problem you faced at work and how you handled it.',
 experience:'Talk about something new you learned recently and why it was useful.'
};
let mediaRecorder=null, activeStream=null,stopTimer=null,firstText='',secondText='',aiFeedback=null,recordingStep='';
$('pilotCode').value = sessionStorage.getItem('bazi_pilot_code')||'';
$('pilotCode').addEventListener('input',()=>sessionStorage.setItem('bazi_pilot_code',$('pilotCode').value));
$('topic').addEventListener('change',()=>{$('prompt').textContent=prompts[$('topic').value];resetResults();});
const busy = (which,label)=>{const node=$(which==='first'?'recordingStatus':'secondStatus');node.textContent=label;node.classList.toggle('busy',/Recording|Processing|Transcribing|Getting/.test(label));};
const requireConsent=()=>{if(!$('pilotCode').value.trim()){alert('Please enter the pilot access code from Canvas first.');$('pilotCode').focus();return false;}if(!$('consent').checked){alert('Please read and agree to the pilot consent statement first.');$('consent').focus();return false;}return true;};
function resetResults(){if(mediaRecorder&&mediaRecorder.state==='recording'){mediaRecorder.stop();}firstText='';secondText='';aiFeedback=null;$('firstResult').classList.add('hidden');$('feedback').classList.add('hidden');$('retrySection').classList.add('hidden');$('reflectionSection').classList.add('hidden');$('secondResult').classList.add('hidden');$('firstText').textContent='';$('secondText').textContent='';$('reflection').value='';busy('first','Ready when you are');busy('second','');$('recordFirst').disabled=false;$('recordSecond').disabled=false;$('firstButtonText').textContent='Start recording';$('secondButtonText').textContent='Record second attempt';}
$('reset').addEventListener('click',()=>{resetResults();window.scrollTo({top:0,behavior:'smooth'});});
async function request(endpoint, data, contentType){
 const r=await fetch(endpoint,{method:'POST',headers:{'x-pilot-code':$('pilotCode').value.trim(),'content-type':contentType},body:data});
 const result=await r.json().catch(()=>({error:'Server response could not be read.'}));if(!r.ok)throw Error(result.error||'Request failed.');return result;
}
async function record(which){
 if(mediaRecorder&&mediaRecorder.state==='recording'){mediaRecorder.stop();return;}
 if(!requireConsent())return;
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){alert('Audio recording is not supported here. Please use a recent Chrome, Edge or Safari browser with microphone permission.');return;}
 const btn=$(which==='first'?'recordFirst':'recordSecond');const text=$(which==='first'?'firstButtonText':'secondButtonText');
 let stream;
 try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){busy(which,'Microphone access was not granted.');return;}
 const options=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
 let recorder;try{recorder=new MediaRecorder(stream,options?{mimeType:options}:undefined);}catch{stream.getTracks().forEach(t=>t.stop());busy(which,'This browser cannot record audio in a supported format.');return;}
 mediaRecorder=recorder;activeStream=stream;recordingStep=which;const chunks=[];
 recorder.ondataavailable=evt=>{if(evt.data.size>0)chunks.push(evt.data);};
 recorder.onstop=async()=>{clearTimeout(stopTimer);stream.getTracks().forEach(t=>t.stop());activeStream=null;mediaRecorder=null;btn.disabled=true;text.textContent=which==='first'?'Start recording':'Record second attempt';busy(which,'Transcribing your recording...');
 try{
  const blob=new Blob(chunks,{type:recorder.mimeType.split(';')[0]||'audio/webm'});
  if(blob.size>6*1024*1024)throw Error('Recording is too large. Please keep it shorter.');
  const response=await request('/api/transcribe',blob,blob.type);const transcript=(response.text||'').trim();if(!transcript)throw Error('No speech was recognised. Try again closer to your microphone.');
  if(which==='first'){firstText=transcript;$('firstText').textContent=transcript;$('firstResult').classList.remove('hidden');busy(which,'Getting AI feedback...');const f=await request('/api/feedback',JSON.stringify({taskId:$('topic').value,transcript}),'application/json');aiFeedback=f;showFeedback(f);$('retrySection').classList.remove('hidden');busy(which,'Feedback ready. You can try again below.');$('feedback').scrollIntoView({behavior:'smooth',block:'start'});}
  else{secondText=transcript;$('secondText').textContent=transcript;$('secondResult').classList.remove('hidden');$('reflectionSection').classList.remove('hidden');busy(which,'Second transcript ready. Reflect on your changes.');$('reflectionSection').scrollIntoView({behavior:'smooth',block:'start'});}
 }catch(e){busy(which,'Error: '+e.message);}finally{btn.disabled=false;}
 };
 recorder.start(250);btn.disabled=false;text.textContent='Stop recording';busy(which,'Recording — press Stop when finished (max 45s)');stopTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},45000);
}
$('recordFirst').addEventListener('click',()=>record('first'));
$('recordSecond').addEventListener('click',()=>record('second'));
function showFeedback(f){$('strength').textContent=f.strength||'No feedback available.';$('suggestions').replaceChildren(...(f.suggestions||[]).map(s=>{const li=document.createElement('li');li.textContent=s;return li;}));$('improvedExample').textContent=f.improvedExample||'';$('topicNote').classList.toggle('hidden',f.onTopic!==false);$('feedback').classList.remove('hidden');}
$('speakExample').addEventListener('click',()=>{if(!aiFeedback?.improvedExample)return;if(!('speechSynthesis' in window)){alert('Speech playback is not available on this browser.');return;}speechSynthesis.cancel();const msg=new SpeechSynthesisUtterance(aiFeedback.improvedExample);msg.lang='en-NZ';msg.rate=.9;speechSynthesis.speak(msg);});
$('copyFeedback').addEventListener('click',async()=>{const out=[`Bazi Speak Web Pilot — anonymous participant feedback`,`Speaking activity: ${$('topic').selectedOptions[0]?.textContent||''}`,`Ease of use: ${$('ease').value||'Not answered'}`,`Clarity of AI feedback: ${$('clear').value||'Not answered'}`,`AI preserved meaning: ${$('meaning').value||'Not answered'}`,`Second attempt useful: ${$('retryUseful').value||'Not answered'}`,`Suggested improvement: ${$('improve').value||'Not answered'}`].join('\n');try{await navigator.clipboard.writeText(out);$('copyStatus').textContent='Copied! You can now paste the anonymous feedback into the Canvas discussion.';}catch{$('copyStatus').textContent='Your browser blocked copying. Please select and copy your answers manually.';}});
