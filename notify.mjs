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
function build(evs,tasks,shop,wx){
const on=s=>evs.filter(e=>occ(e,s)).sort((a,b)=>(a.time||"")<(b.time||"")?-1:1);
const line=e=>(e.time?e.time+" ":"")+e.title+(e.end&&e.end>e.date?" (do "+dm(e.end)+")":"");
const tm=ad(today,1),H=[],T=[];
const sec=(t,items)=>{H.push("<h3 style=\"margin:18px 0 6px;font-size:15px\">"+esc(t)+"</h3>"+(items.length?"<ul style=\"margin:0;padding-left:20px\">"+items.map(x=>"<li>"+esc(x)+"</li>").join("")+"</ul>":"<div style=\"color:#777\">Nic.</div>"));T.push("\n"+t+"\n"+(items.length?items.map(x=>"- "+x).join("\n"):"Nic."))};
const dl=new Date(today+"T12:00:00").toLocaleDateString("cs-CZ",{weekday:"long",day:"numeric",month:"numeric"});
if(wx)sec("Počasí v Brně",[wx]);
sec("Dnes ("+dl+")",on(today).map(line));
sec("Zítra",on(tm).map(line));
const od=tasks.filter(t=>t.due&&t.due<today),dd=tasks.filter(t=>t.due===today||t.due===tm),rest=tasks.length-od.length-dd.length;
sec("Úkoly",[...od.map(t=>t.title+" (po termínu od "+dm(t.due)+")"),...dd.map(t=>t.title+" (termín "+(t.due===today?"dnes":"zítra")+")"),...(rest>0?["Dalších otevřených: "+rest]:[])]);
if(shop.length)sec("Nákup ("+shop.length+")",[shop.slice(0,10).map(t=>t.title).join(", ")+(shop.length>10?" …":"")]);
return{subject:"HUB: "+dl,html:"<div style=\"font-family:system-ui,sans-serif;max-width:520px\"><h2 style=\"margin:0 0 4px\">Dobré ráno</h2>"+H.join("")+"</div>",text:"Dobré ráno\n"+T.join("\n")}}
if(!MODE){console.log("V Praze je "+hour+" h, mimo okna odesílání (7 až 12 a 20 až 23 h), nic neposílám.");process.exit(0)}
const sref=root.collection("meta").doc("notify_"+MODE),sd=await sref.get();
if(!FORCE&&sd.exists&&sd.data().date===today){console.log("Dnes už odesláno.");process.exit(0)}
if(MODE==="evening"){
const ts=await db.collectionGroup("tokens").get();let n=0;
for(const t of ts.docs){const x=t.data();if(x.purpose!=="fin"||!x.token)continue;const uid=t.ref.parent.parent.id;
if(!FORCE&&(await db.doc("users/"+uid+"/fin/"+today).get()).exists){console.log("Hodnota už zadána, přeskakuji.");continue}
try{await getMessaging().send({token:x.token,data:{title:"Finance",body:"Zadej dnešní hodnotu portfolia.",url:"finance.html"}});n++}
catch(e){console.warn("Push selhal:",e.code);if(e.code==="messaging/registration-token-not-registered"||e.code==="messaging/invalid-registration-token")await t.ref.delete()}}
await sref.set({date:today,n});console.log("Odesláno pushek: "+n)}
else{
if(!E.GMAIL_USER||!E.GMAIL_APP_PASSWORD||!E.MAIL_TO){console.error("Chybí GMAIL_USER, GMAIL_APP_PASSWORD nebo MAIL_TO.");process.exit(1)}
const get=async n=>(await root.collection(n).get()).docs.map(d=>d.data());
const evs=(await get("events")).filter(e=>/^\d{4}-\d\d-\d\d$/.test(e.date)&&e.title),tasks=(await get("tasks")).filter(t=>t.done!==true&&t.title),shop=(await get("shop")).filter(t=>t.done!==true&&t.title);
let wx="";try{const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude=49.1951&longitude=16.6068&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FPrague&forecast_days=1"),d=(await r.json()).daily,[ic,tx]=wc(d.weather_code[0]);wx=ic+" "+tx+", "+Math.round(d.temperature_2m_min[0])+"° až "+Math.round(d.temperature_2m_max[0])+"°, srážky "+(d.precipitation_probability_max[0]??"–")+" %"}catch(e){console.warn("Počasí se nenačetlo.")}
const m=build(evs,tasks,shop,wx);
await nodemailer.createTransport({service:"gmail",auth:{user:E.GMAIL_USER,pass:E.GMAIL_APP_PASSWORD}}).sendMail({from:'"HUB" <'+E.GMAIL_USER+">",to:E.MAIL_TO,subject:m.subject,html:m.html,text:m.text});
await sref.set({date:today});console.log("E-mail odeslán.")}
