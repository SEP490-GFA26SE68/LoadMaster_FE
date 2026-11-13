export function catalogType(id:number){return {id,name:'Type '+String(id).padStart(3,'0'),innerLength:400,innerWidth:200,innerHeight:200,doorWidth:null,doorHeight:null,maxPayloadKg:id*100,frontAxleLimitKg:null,rearAxleLimitKg:null,maxCogOffsetRatio:0.15,hazardousCapable:false,obstacles:[],vehicleCount:id}}
export function catalogPage(url:URL,count=100){
 const p=Number(url.searchParams.get('page')??0),size=Number(url.searchParams.get('size')??20),q=url.searchParams.get('search')?.toLowerCase()
 const rows=Array.from({length:count},(_,i)=>catalogType(i+1)).filter(r=>!q||r.name.toLowerCase().includes(q))
 return {success:true,data:rows.slice(p*size,(p+1)*size),page:p,size,totalElements:rows.length,totalPages:Math.ceil(rows.length/size),last:(p+1)*size>=rows.length}
}
