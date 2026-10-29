import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import{getFirestore,collection,doc,setDoc,deleteDoc,onSnapshot}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const fs=getFirestore(initializeApp({apiKey:"AIzaSyC2SgxfHJMHtb-C4A2QTjwXaNQ1EiFRIj0",authDomain:"hubnebik.firebaseapp.com",projectId:"hubnebik",storageBucket:"hubnebik.firebasestorage.app",messagingSenderId:"469840567753",appId:"1:469840567753:web:5ca65b5c8d00fd952a9c18"}));
export const ymd=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
export function msg(t){const m=document.getElementById("msg");if(!m)return;m.textContent=t;clearTimeout(msg.t);msg.t=setTimeout(()=>m.textContent="",8000)}
const g=i=>document.getElementById(i),auth=getAuth(),ov=document.createElement("div");
ov.style.cssText="position:fixed;inset:0;z-index:99;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:16px";
ov.innerHTML='<form id="lf" style="visibility:hidden;width:100%;max-width:320px;margin:0"><h1 style="margin:0 0 4px">HUB</h1><input id="le" type="email" placeholder="E-mail" required autocomplete="username"><input id="lp" type="password" placeholder="Heslo" required autocomplete="current-password"><button class="add" type="submit">Přihlásit</button><div id="lm" style="color:var(--red);font-size:14px"></div></form>';
document.body.append(ov);
g("lf").onsubmit=e=>{e.preventDefault();signInWithEmailAndPassword(auth,g("le").value,g("lp").value).catch(()=>g("lm").textContent="Přihlášení se nepovedlo. Zkontroluj e-mail a heslo.")};
const authed=new Promise(res=>onAuthStateChanged(auth,u=>{if(u){ov.remove();res(u)}else{if(!ov.isConnected)document.body.append(ov);g("lf").style.visibility="visible"}}));
export const logout=()=>signOut(auth);
export const sync=(n,cb)=>authed.then(()=>onSnapshot(collection(fs,"spaces","main",n),s=>cb(s.docs.map(d=>({...d.data(),id:d.id}))),()=>msg("Data se nepodařilo načíst. Zkontroluj přihlášení a pravidla databáze.")));
export const put=(n,o)=>authed.then(()=>{const{id,...b}=o;return setDoc(doc(fs,"spaces","main",n,id),b)}).catch(()=>msg("Uložení se nepovedlo."));
export const del=(n,id)=>authed.then(()=>deleteDoc(doc(fs,"spaces","main",n,id))).catch(()=>msg("Smazání se nepovedlo."));
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da)}
const hc={};
export function hols(y){if(hc[y])return hc[y];const h={},E=easter(y),add=(m,d,n)=>h[y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0")]=n;
const gf=new Date(y,E.getMonth(),E.getDate()-2),em=new Date(y,E.getMonth(),E.getDate()+1);
add(1,1,"Nový rok, Den obnovy samostatného českého státu");add(gf.getMonth()+1,gf.getDate(),"Velký pátek");add(em.getMonth()+1,em.getDate(),"Velikonoční pondělí");
add(5,1,"Svátek práce");add(5,8,"Den vítězství");add(7,5,"Den slovanských věrozvěstů Cyrila a Metoděje");add(7,6,"Den upálení mistra Jana Husa");add(9,28,"Den české státnosti");add(10,28,"Den vzniku samostatného československého státu");add(11,17,"Den boje za svobodu a demokracii");add(12,24,"Štědrý den");add(12,25,"1. svátek vánoční");add(12,26,"2. svátek vánoční");
return hc[y]=h}
