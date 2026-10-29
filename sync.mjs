import{initializeApp,cert}from"firebase-admin/app";
import{getFirestore}from"firebase-admin/firestore";
const URL_=process.env.GCAL_ICS_URL,SA=process.env.FIREBASE_SERVICE_ACCOUNT;
if(!URL_||!SA){console.error("Chybí tajné proměnné GCAL_ICS_URL nebo FIREBASE_SERVICE_ACCOUNT.");process.exit(1)}
const OWNER="Sabina",SKIP_PRIVATE=true;
const fm=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const prague=dt=>{const p=Object.fromEntries(fm.formatToParts(dt).map(x=>[x.type,x.value]));return{d:p.year+"-"+p.month+"-"+p.day,t:p.hour+":"+p.minute}};
const un=v=>v.replace(/\\n/gi," ").replace(/\\([,;\\])/g,"$1"),hash=x=>{let h=5381;for(const c of x)h=(h*33^c.charCodeAt(0))>>>0;return h.toString(36)+x.length.toString(36)};
const RX=/^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)?(Z)?)?$/,items=[],sk={},bump=k=>sk[k]=(sk[k]||0)+1;
function fin(c){
if(!c.DTSTART||!c.SUMMARY){bump("bez data nebo názvu");return}
if(c["RECURRENCE-ID"]){bump("upravená výjimka z opakování");return}
if(c.STATUS&&/CANCELLED/i.test(c.STATUS)){bump("zrušené");return}
if(SKIP_PRIVATE&&c.CLASS&&/PRIVATE|CONFIDENTIAL/i.test(c.CLASS)){bump("soukromé");return}
const v=c.DTSTART,m=v.match(RX);if(!m){bump("nečitelné datum");return}
let d=m[1]+"-"+m[2]+"-"+m[3],t="";
if(m[4]){if(m[7]){const x=prague(new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])));d=x.d;t=x.t}else t=m[4]+":"+m[5]}
let rep="",until="";
if(c.RRULE){const r={};c.RRULE.split(";").forEach(x=>{const[a,b]=x.split("=");r[a]=b});
const F={DAILY:"d",WEEKLY:"w",MONTHLY:"m",YEARLY:"y"}[r.FREQ];
if(!F||(r.INTERVAL&&r.INTERVAL!=="1")||r.BYSETPOS||(F==="m"&&r.BYDAY)||(F==="w"&&r.BYDAY&&r.BYDAY.includes(","))){bump("složité opakování");return}
rep=F;
if(r.UNTIL){const u=r.UNTIL.match(/^(\d{4})(\d\d)(\d\d)/);if(u)until=u[1]+"-"+u[2]+"-"+u[3]}
else if(r.COUNT){const n=+r.COUNT-1,b=new Date(Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10)));if(F==="d")b.setUTCDate(b.getUTCDate()+n);if(F==="w")b.setUTCDate(b.getUTCDate()+7*n);if(F==="m")b.setUTCMonth(b.getUTCMonth()+n);if(F==="y")b.setUTCFullYear(b.getUTCFullYear()+n);until=b.toISOString().slice(0,10)}}
let end="";const w=c.DTEND&&c.DTEND.match(RX);
if(w){const e2=w[4]?(w[7]?prague(new Date(Date.UTC(+w[1],+w[2]-1,+w[3],+w[4],+w[5]))).d:w[1]+"-"+w[2]+"-"+w[3]):new Date(Date.UTC(+w[1],+w[2]-1,+w[3]-1)).toISOString().slice(0,10);if(e2>d)end=e2}
items.push({uid:c.UID||v+c.SUMMARY,date:d,time:t,title:un(c.SUMMARY).slice(0,80),rep,until,end})}
function parse(txt){let c=null;txt.replace(/\r?\n[ \t]/g,"").split(/\r?\n/).forEach(l=>{if(l==="BEGIN:VEVENT"){c={};return}if(l==="END:VEVENT"){if(c)fin(c);c=null;return}if(!c)return;const i=l.indexOf(":");if(i<0)return;const k=l.slice(0,i).split(";")[0].toUpperCase();if(!(k in c))c[k]=l.slice(i+1)})}
const res=await fetch(URL_);
if(!res.ok){console.error("Stažení kalendáře selhalo, stav "+res.status+". Zkontroluj tajnou adresu.");process.exit(1)}
parse(await res.text());
console.log("Načteno událostí: "+items.length+(Object.keys(sk).length?", přeskočeno: "+JSON.stringify(sk):""));
if(!items.length){console.error("Kalendář je prázdný nebo se nepodařilo přečíst, nic nemažu ani nepřepisuji.");process.exit(1)}
initializeApp({credential:cert(JSON.parse(SA))});
const db=getFirestore(),root=db.collection("spaces").doc("main"),col=root.collection("events");
const have=new Map((await col.get()).docs.map(d=>[d.id,d.data()])),bw=db.bulkWriter(),ids=new Set();
let nw=0,up=0;
for(const e of items){const id="i"+hash(e.uid);ids.add(id);
const f={date:e.date,time:e.time,title:e.title,rep:e.rep,until:e.until,end:e.end,src:"gcal"},x=have.get(id);
if(!x){bw.set(col.doc(id),{...f,type:"other",by:OWNER,col:""});nw++}
else if(Object.keys(f).some(k=>(x[k]||"")!==f[k])){bw.set(col.doc(id),f,{merge:true});up++}}
const managed=[...have].filter(([,x])=>x.src==="gcal"),gone=managed.filter(([id])=>!ids.has(id));
let rm=0;
if(gone.length>Math.max(10,managed.length*0.5))console.warn("Mazání přeskočeno: chybí podezřele mnoho událostí ("+gone.length+" z "+managed.length+").");
else{gone.forEach(([id])=>bw.delete(col.doc(id)));rm=gone.length}
bw.set(root.collection("meta").doc("gcal"),{at:new Date().toISOString(),n:items.length,added:nw,updated:up,removed:rm});
await bw.close();
console.log("Hotovo: nových "+nw+", změněných "+up+", odstraněných "+rm+".");
