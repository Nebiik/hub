import{initializeApp,cert}from"firebase-admin/app";
import{getFirestore}from"firebase-admin/firestore";
import{getMessaging}from"firebase-admin/messaging";
const E=process.env;
const add=(E.ADD||"").trim(),buy=(E.BUY||"").trim(),who=(E.WHO||"").trim()||"někdo";
if(!add&&!buy){console.log("Nic k odeslání.");process.exit(0)}
initializeApp({credential:cert(JSON.parse(E.FIREBASE_SERVICE_ACCOUNT))});
const db=getFirestore(),parts=[];
if(add)parts.push("přidáno – "+add);if(buy)parts.push("koupeno – "+buy);
const body=parts.join("; ")+" ("+who+")";
let n=0;
for(const t of (await db.collectionGroup("tokens").get()).docs){const x=t.data(),uid=t.ref.parent.parent.id;if(!x.token||uid===E.ACTOR)continue;
const s=await db.doc("users/"+uid+"/settings/notif").get();if(s.exists&&s.data().shop===false)continue;
try{await getMessaging().send({token:x.token,data:{title:"Nákup",body,url:"nakup.html"}});n++}
catch(e){console.warn("Push selhal:",e.code);if(/not-registered|invalid-registration/.test(e.code||""))await t.ref.delete()}}
console.log("Odesláno pushek: "+n);
