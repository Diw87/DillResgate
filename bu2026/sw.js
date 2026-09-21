const CACHE_VERSION="dwtech-bu2026-v10-native-auth";
const STATIC_CACHE=CACHE_VERSION+"-static";
const RUNTIME_CACHE=CACHE_VERSION+"-runtime";
const SHELL=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./VERSION.json",
  "./qr-scanner.css",
  "./qr-scanner.js",
  "./pwa.js",
  "./cloud.css",
  "./cloud.js",
  "./jsQR.js",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
  "./icons/icon-maskable-512.svg"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(STATIC_CACHE).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>!k.startsWith(CACHE_VERSION)).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

async function networkFirst(request,fallbackUrl){
  const cache=await caches.open(RUNTIME_CACHE);
  try{
    const response=await fetch(request);
    if(response&&response.ok)cache.put(request,response.clone());
    return response;
  }catch(err){
    const cached=await cache.match(request);
    if(cached)return cached;
    if(fallbackUrl){
      const shell=await caches.open(STATIC_CACHE);
      const fallback=await shell.match(fallbackUrl);
      if(fallback)return fallback;
    }
    throw err;
  }
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(RUNTIME_CACHE);
  const cached=await cache.match(request);
  const fetchPromise=fetch(request).then(response=>{
    if(response&&response.ok)cache.put(request,response.clone());
    return response;
  }).catch(()=>null);
  return cached||fetchPromise;
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==="navigate"){
    event.respondWith(networkFirst(request,"./index.html"));
    return;
  }

  if(url.pathname.endsWith("/candidatos.json")){
    event.respondWith(networkFirst(request));
    return;
  }

  if(["style","script","image","font"].includes(request.destination)){
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
});