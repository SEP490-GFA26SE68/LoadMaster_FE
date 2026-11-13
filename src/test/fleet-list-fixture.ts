export const fleetFixture=Array.from({length:100},(_,i)=>{
 const id=i+1
 return {id,name:id===90?'Target truck':id===10||id===11?'Same name':'Vehicle '+String(id).padStart(3,'0'),
 licensePlate:'PLATE-'+String(id).padStart(3,'0'),vehicleTypeId:id%2===0?2:1,vehicleTypeName:id%2===0?'Cold':'Box',
 companyId:1,companyName:'Fixture A',status:id===76||id===77?'MAINTENANCE':id===78?'RETIRED':id===1||id===2?'IN_TRIP':'AVAILABLE'}
})
export function fleetListResponse(url:URL){
 const q=url.searchParams,term=(q.get('search')??'').trim().toLowerCase()
 const rows=fleetFixture.filter(row=>(!term||[row.name,row.licensePlate,String(row.id)].some(s=>s.toLowerCase().includes(term)))&&
  (!q.get('status')||row.status===q.get('status'))&&(!q.get('vehicleTypeId')||String(row.vehicleTypeId)===q.get('vehicleTypeId')))
 const field=q.get('sortBy')??'name',dir=q.get('sortDir')==='DESC'?-1:1
 const rank=['AVAILABLE','IN_TRIP','MAINTENANCE','RETIRED']
 const value=(r:(typeof rows)[number]):string|number=>field==='status'?rank.indexOf(r.status):(r as unknown as Record<string,string|number>)[field]!
 rows.sort((a,b)=>{
  const av=value(a),bv=value(b)
  const n=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv))
  return n*dir||a.id-b.id
 })
 const page=Number(q.get('page')??0),size=Number(q.get('size')??25)
 return {success:true,data:rows.slice(page*size,(page+1)*size),page,size,totalElements:rows.length,totalPages:Math.ceil(rows.length/size),last:(page+1)*size>=rows.length}
}
