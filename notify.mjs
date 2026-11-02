import{initializeApp,cert}from"firebase-admin/app";
import{getFirestore}from"firebase-admin/firestore";
import{getMessaging}from"firebase-admin/messaging";
import nodemailer from"nodemailer";
const E=process.env,FORCE=E.FORCE==="true";
if(!E.FIREBASE_SERVICE_ACCOUNT){console.error("Chybí FIREBASE_SERVICE_ACCOUNT.");process.exit(1)}
initializeApp({credential:cert(JSON.parse(E.FIREBASE_SERVICE_ACCOUNT))});
const db=getFirestore(),root=db.collection("spaces").doc("main");
const pp=Object.fromEntries(new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const today=pp.year+"-"+pp.month+"-"+pp.day,hour=+pp.hour,MODE=FORCE?(E.MODE==="evening"?"evening":"morning"):(hour>=7&&hour<12?"morning":hour>=20&&hour<23?"evening":null);
const dn=s=>Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10))/864e5,ad=(s,k)=>new Date((dn(s)+k)*864e5).toISOString().slice(0,10);
function occ1(e,s){if(s<e.date||(e.until&&s>e.until))return false;const r=e.rep||(e.type==="bday"||e.type==="nday"?"y":"");
if(!r)return s===e.date;if(r==="d")return true;if(r==="w")return(dn(s)-dn(e.date))%7===0;if(r==="m")return s.slice(8)===e.date.slice(8);return s.slice(5)===e.date.slice(5)}
function occ(e,s){const L=e.end&&e.end>e.date?Math.min(366,dn(e.end)-dn(e.date)):0;for(let k=0;k<=L;k++)if(occ1(e,ad(s,-k)))return true;return false}
const wc=c=>c===0?["☀️","Jasno"]:c===1?["🌤️","Převážně jasno"]:c===2?["⛅","Polojasno"]:c===3?["☁️","Zataženo"]:c<=48?["🌫️","Mlha"]:c<=55?["🌦️","Mrholení"]:c<=57?["🌧️","Mrznoucí mrholení"]:c<=65?["🌧️","Déšť"]:c<=67?["🌧️","Mrznoucí déšť"]:c<=77?["🌨️","Sněžení"]:c<=82?["🌦️","Přeháňky"]:c<=86?["🌨️","Sněhové přeháňky"]:["⛈️","Bouřka"];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dm=s=>new Date(s+"T12:00:00").toLocaleDateString("cs-CZ",{day:"numeric",month:"numeric"});
const lineE=e=>(e.time?e.time+" ":"")+e.title+(e.end&&e.end>e.date?" (do "+dm(e.end)+")":"");
function build(evs,tasks,shop,wx){
const on=s=>evs.filter(e=>occ(e,s)).sort((a,b)=>(a.time||"")<(b.time||"")?-1:1);
const tm=ad(today,1),H=[],T=[];
const sec=(t,items)=>{H.push("<h3 style=\"margin:18px 0 6px;font-size:15px\">"+esc(t)+"</h3>"+(items.length?"<ul style=\"margin:0;padding-left:20px\">"+items.map(x=>"<li>"+esc(x)+"</li>").join("")+"</ul>":"<div style=\"color:#777\">Nic.</div>"));T.push("\n"+t+"\n"+(items.length?items.map(x=>"- "+x).join("\n"):"Nic."))};
const dl=new Date(today+"T12:00:00").toLocaleDateString("cs-CZ",{weekday:"long",day:"numeric",month:"numeric"});
if(wx)sec("Počasí v Brně",[wx]);
sec("Dnes ("+dl+")",on(today).map(lineE));
sec("Zítra",on(tm).map(lineE));
const od=tasks.filter(t=>t.due&&t.due<today),dd=tasks.filter(t=>t.due===today||t.due===tm),rest=tasks.length-od.length-dd.length;
sec("Úkoly",[...od.map(t=>t.title+" (po termínu od "+dm(t.due)+")"),...dd.map(t=>t.title+" (termín "+(t.due===today?"dnes":"zítra")+")"),...(rest>0?["Dalších otevřených: "+rest]:[])]);
if(shop.length)sec("Nákup ("+shop.length+")",[shop.slice(0,10).map(t=>t.title).join(", ")+(shop.length>10?" …":"")]);
return{subject:"HUB: "+dl,html:"<div style=\"font-family:system-ui,sans-serif;max-width:520px\"><h2 style=\"margin:0 0 4px\">Dobré ráno</h2>"+H.join("")+"</div>",text:"Dobré ráno\n"+T.join("\n")}}
if(!MODE){console.log("V Praze je "+hour+" h, mimo okna odesílání (7 až 12 a 20 až 23 h), nic neposílám.");process.exit(0)}
if(!FORCE){const ds=await Promise.all((MODE==="morning"?["m_push","m_mail"]:["e_push"]).map(n=>root.collection("meta").doc("notify_"+n).get()));
if(ds.every(d=>d.exists&&d.data().date===today)){console.log("Dnes už je vše odesláno.");process.exit(0)}}
const once=async(name,fn)=>{const ref=root.collection("meta").doc("notify_"+name),d=await ref.get();if(!FORCE&&d.exists&&d.data().date===today){console.log(name+": dnes už odesláno.");return}await fn();await ref.set({date:today})};
const send=async(r,title,body,url)=>{try{await getMessaging().send({token:r.token,data:{title,body,url}});return true}catch(e){console.warn("Push selhal:",e.code);if(/not-registered|invalid-registration/.test(e.code||""))await r.ref.delete();return false}};
async function recipients(){const ts=await db.collectionGroup("tokens").get(),c={},out=[];
for(const t of ts.docs){const x=t.data();if(!x.token)continue;const uid=t.ref.parent.parent.id;
if(!c[uid]){const s=await db.doc("users/"+uid+"/settings/notif").get(),f=await db.collection("users/"+uid+"/fin").limit(1).get();c[uid]={st:s.exists?s.data():{},fin:!f.empty}}
out.push({token:x.token,ref:t.ref,uid,st:c[uid].st,fin:c[uid].fin})}return out}
const get=async n=>(await root.collection(n).get()).docs.map(d=>d.data());
const evs=(await get("events")).filter(e=>/^\d{4}-\d\d-\d\d$/.test(e.date)&&e.title),rec=await recipients();
async function evPush(day,rem,label){let n=0;const list=evs.filter(e=>e.rem===rem&&occ(e,day));
for(const r of rec){if(r.st.cal===false)continue;const l=list.filter(e=>!e.by||!r.st.who||r.st.who===e.by);if(!l.length)continue;
if(await send(r,"Kalendář",label+l.slice(0,5).map(lineE).join(", ")+(l.length>5?" …":""),"kalendar.html"))n++}return n}
if(MODE==="morning"){
await once("m_push",async()=>{console.log("Pushek (kalendář): "+await evPush(today,"d0","Dnes: "))});
await once("m_mail",async()=>{
if(!E.GMAIL_USER||!E.GMAIL_APP_PASSWORD||!E.MAIL_TO){console.warn("Chybí GMAIL_USER, GMAIL_APP_PASSWORD nebo MAIL_TO, e-mail přeskakuji.");return}
const tasks=(await get("tasks")).filter(t=>t.done!==true&&t.title),shop=(await get("shop")).filter(t=>t.done!==true&&t.title);
let wx="";try{const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude=49.1951&longitude=16.6068&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FPrague&forecast_days=1"),d=(await r.json()).daily,[ic,tx]=wc(d.weather_code[0]);wx=ic+" "+tx+", "+Math.round(d.temperature_2m_min[0])+"° až "+Math.round(d.temperature_2m_max[0])+"°, srážky "+(d.precipitation_probability_max[0]??"–")+" %"}catch(e){console.warn("Počasí se nenačetlo.")}
const m=build(evs,tasks,shop,wx);
await nodemailer.createTransport({service:"gmail",auth:{user:E.GMAIL_USER,pass:E.GMAIL_APP_PASSWORD}}).sendMail({from:'"HUB" <'+E.GMAIL_USER+">",to:E.MAIL_TO,subject:m.subject,html:m.html,text:m.text});console.log("E-mail odeslán.")})}
else{
await once("e_push",async()=>{let n=0;
for(const r of rec){if(r.st.fin===false||!r.fin)continue;if(!FORCE&&(await db.doc("users/"+r.uid+"/fin/"+today).get()).exists)continue;if(await send(r,"Finance","Zadej dnešní hodnotu portfolia.","finance.html"))n++}
console.log("Pushek (finance): "+n+", (kalendář): "+await evPush(ad(today,1),"d1","Zítra: "))})}
