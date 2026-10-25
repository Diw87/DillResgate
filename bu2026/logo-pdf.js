/* DW Tech: mesma logo nos PDF; rasterização sob demanda para jsPDF. */
(()=>{"use strict";
 let imageData=null,pending=null;
 function prepare(){
  if(imageData)return Promise.resolve(imageData);
  if(pending)return pending;
  pending=new Promise(resolve=>{
   const img=new Image();
   img.onload=()=>{
    try{
     const canvas=document.createElement("canvas");
     canvas.width=1180;canvas.height=263;
     const ctx=canvas.getContext("2d");
     if(!ctx)throw Error("Canvas indisponível");
     ctx.drawImage(img,0,0,1180,263);
     imageData=canvas.toDataURL("image/png");
    }catch(e){console.info("Logo PDF: usando assinatura de texto",e);}
    resolve(imageData);
   };
   img.onerror=()=>resolve(null);
   img.src="./logo-dwtech-dark.svg?build=20261024.5";
  }).finally(()=>{pending=null;});
  return pending;
 }
 function paint(pdf,x,y,width){
  if(!imageData)return false;
  try{pdf.addImage(imageData,"PNG",x,y,width,width*263/1180);return true;}
  catch(e){console.warn("Logo PDF indisponível nesta página",e);return false;}
 }
 window.DWBrandPdf={prepare,paint};
})();