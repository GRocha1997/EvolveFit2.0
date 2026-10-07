const CACHE="evolvefit-pwa-v2";
const SHELL=["./","./index.html","./manifest.webmanifest","./evolvefit-icon-192.png","./evolvefit-icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  const u=new URL(e.request.url);
  if(e.request.mode==="navigate"){
    e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put("./index.html",cp));return r}).catch(()=>caches.match("./index.html").then(r=>r||caches.match("./"))));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r&&r.status===200){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}return r}).catch(()=>hit)));
});
self.addEventListener("message",e=>{
  if(e.data&&e.data.type==="TEST_NOTIFICATION"){
    self.registration.showNotification("EvolveFit",{body:"Notificações ativadas.",icon:"./evolvefit-icon-192.png",badge:"./evolvefit-icon-192.png",tag:"evolvefit-test"});
  }
});
self.addEventListener("push",e=>{
  let data={title:"EvolveFit",body:"Tens uma atualização."};
  try{data={...data,...e.data.json()}}catch(_){try{data.body=e.data.text()}catch(_){}}
  e.waitUntil(self.registration.showNotification(data.title||"EvolveFit",{body:data.body||"",icon:"./evolvefit-icon-192.png",badge:"./evolvefit-icon-192.png",data:data.url||"./",tag:data.tag||"evolvefit"}));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  const target=e.notification.data||"./";
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{for(const c of list){if("focus" in c){c.navigate(target);return c.focus();}}return clients.openWindow(target)}));
});