import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import{getFirestore,collection,doc,setDoc,deleteDoc,onSnapshot}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const fs=getFirestore(initializeApp({apiKey:"AIzaSyC2SgxfHJMHtb-C4A2QTjwXaNQ1EiFRIj0",authDomain:"hubnebik.firebaseapp.com",projectId:"hubnebik",storageBucket:"hubnebik.firebasestorage.app",messagingSenderId:"469840567753",appId:"1:469840567753:web:5ca65b5c8d00fd952a9c18"}));
export const ymd=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
export function msg(t){const m=document.getElementById("msg");if(!m)return;m.textContent=t;clearTimeout(msg.t);msg.t=setTimeout(()=>m.textContent="",8000)}
function getCode(){let c=location.hash.slice(1);try{if(c)localStorage.setItem("hubcode",c);else c=localStorage.getItem("hubcode")||""}catch(e){}
if(!c){c=prompt("Zadejte společný kód HUBu:")||"";try{localStorage.setItem("hubcode",c)}catch(e){}}
return c.replace(/[^A-Za-z0-9_-]/g,"")}
const C=getCode(),ok=C.length>=8;
const noCode=()=>msg("Chybí společný kód (min. 8 znaků). Na úvodní stránce ho změníte.");
export function sync(n,cb){if(!ok){noCode();return}
onSnapshot(collection(fs,"spaces",C,n),s=>cb(s.docs.map(d=>({...d.data(),id:d.id}))),()=>msg("Data se nepodařilo načíst. Zkontrolujte kód a pravidla databáze."))}
export function put(n,o){if(!ok){noCode();return}const{id,...b}=o;return setDoc(doc(fs,"spaces",C,n,id),b).catch(()=>msg("Uložení se nepovedlo."))}
export function del(n,id){if(!ok){noCode();return}return deleteDoc(doc(fs,"spaces",C,n,id)).catch(()=>msg("Smazání se nepovedlo."))}
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da)}
const hc={};
export function hols(y){if(hc[y])return hc[y];const h={},E=easter(y),add=(m,d,n)=>h[y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0")]=n;
const gf=new Date(y,E.getMonth(),E.getDate()-2),em=new Date(y,E.getMonth(),E.getDate()+1);
add(1,1,"Nový rok, Den obnovy samostatného českého státu");add(gf.getMonth()+1,gf.getDate(),"Velký pátek");add(em.getMonth()+1,em.getDate(),"Velikonoční pondělí");
add(5,1,"Svátek práce");add(5,8,"Den vítězství");add(7,5,"Den slovanských věrozvěstů Cyrila a Metoděje");add(7,6,"Den upálení mistra Jana Husa");add(9,28,"Den české státnosti");add(10,28,"Den vzniku samostatného československého státu");add(11,17,"Den boje za svobodu a demokracii");add(12,24,"Štědrý den");add(12,25,"1. svátek vánoční");add(12,26,"2. svátek vánoční");
return hc[y]=h}
