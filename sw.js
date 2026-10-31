self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",()=>{});
self.addEventListener("push",e=>{let p={};try{p=e.data.json()}catch(z){}const n=p.notification||{},d=p.data||{};
e.waitUntil(self.registration.showNotification(n.title||d.title||"HUB",{body:n.body||d.body||"",icon:"icon-192.png",badge:"icon-192.png",data:{url:d.url||"index.html"}}))});
self.addEventListener("notificationclick",e=>{e.notification.close();const u=new URL(e.notification.data.url,self.registration.scope).href;
e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>{for(const c of l){if(c.url.startsWith(self.registration.scope)){if(c.navigate)c.navigate(u);return c.focus()}}return clients.openWindow(u)}))});
