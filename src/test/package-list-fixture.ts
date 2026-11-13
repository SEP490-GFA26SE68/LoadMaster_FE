/** Synthetic fixtures only. Never reads an application database. */
export const warehouseTypes=Array.from({length:80},(_,i)=>({
 id:i+1,companyId:1,name:i===60?'Target type':'Type '+String(i+1).padStart(3,'0'),typeCode:'TYPE-'+(i+1),
 length:50,width:30,height:20,weightKg:i+1,maxStackingWeightKg:100,isFragile:false,
 rotationAllowed:true,allowRotateX:true,allowRotateY:true,allowRotateZ:true,
}))
export const warehousePackages=Array.from({length:200},(_,i)=>({
 id:i+1,orderId:null,packageTypeId:61,packageTypeName:'Target type',packageTypeCode:'TYPE-61',
 packageCode:'PKG-'+String(i+1).padStart(3,'0'),packageName:i===125?'Target parcel':'Parcel',
 trackingBarcode:'TRACK-'+(i+1),qrToken:'fixture-qr-'+(i+1),actualLength:50,actualWidth:30,actualHeight:20,
 actualWeightKg:i+1,handlingClass:(i+1)%3===0?'FRAGILE':'STANDARD',destination:'Depot',
 status:(i+1)%2===0?'RETURNED':'PENDING',isPinned:false,
}))
export function warehouseListResponse(url:URL) {
 const q=url.searchParams,types=url.pathname.includes('package-types')
 const source:Record<string,unknown>[]=types?warehouseTypes:warehousePackages
 const term=(q.get('search')??'').trim().toLowerCase()
 let rows=source.filter(row=>(!term || ['id','name','typeCode','packageCode','packageName','packageTypeName','packageTypeCode','trackingBarcode','qrToken','destination'].some(k=>String(row[k]??'').toLowerCase().includes(term)))&&
  (!q.get('status')||row.status===q.get('status'))&&(!q.get('handlingClass')||row.handlingClass===q.get('handlingClass')))
 const field=q.get('sortBy')??'id',direction=q.get('sortDir')==='DESC'?-1:1
 rows=rows.toSorted((a,b)=>{
  const av=a[field],bv=b[field]
  if(av==null||bv==null)return av==null?(bv==null?Number(a.id)-Number(b.id):1):-1
  const order=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv))
  return order*direction||Number(a.id)-Number(b.id)
 })
 const page=Number(q.get('page')??0),size=Number(q.get('size')??25)
 return {success:true,data:rows.slice(page*size,(page+1)*size),page,size,totalElements:rows.length,totalPages:Math.ceil(rows.length/size),last:(page+1)*size>=rows.length}
}
