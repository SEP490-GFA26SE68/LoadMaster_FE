export const requirementsFixture=Array.from({length:110},(_,i)=>({
 id:i+1,companyId:1,customerId:1,customerName:'Customer fixture',destination:i>=108?'Target destination':'Depot '+String(i+1).padStart(3,'0'),
 destinationLat:null,destinationLng:null,deadline:'2026-11-12T23:59:59.999999',priority:i>=108?'HIGH':'NORMAL',status:i>=108?'ASSIGNED':'PENDING',
 expectedPackageCount:4,receivedPackageCount:4,packageIds:[],note:null,tripId:i>=108?9:null,tripCode:i>=108?'TRIP-TARGET':null,
 shortDelivered:i>=108,createdBy:8,createdAt:'2026-11-12T08:00:00',
}))
function paged<T>(rows:T[],u:URL){
 const page=Number(u.searchParams.get('page')??0),size=Number(u.searchParams.get('size')??25)
 return {success:true,data:rows.slice(page*size,(page+1)*size),page,size,totalElements:rows.length,totalPages:Math.ceil(rows.length/size),last:(page+1)*size>=rows.length}
}
export function dispatcherListResponse(u:URL){
 if(u.pathname==='/api/vehicles')return paged(Array.from({length:130},(_,i)=>({id:i+1,companyId:1,name:'Vehicle '+(i+1),licensePlate:'PLATE-'+(i+1),status:'AVAILABLE',vehicleTypeId:1,vehicleTypeName:'Box'})),u)
 if(u.pathname==='/api/trips/driver-options')return {success:true,data:[{id:390,fullName:'Driver page three'}]}
 if(u.pathname==='/api/trips'){
  let trips=Array.from({length:130},(_,i)=>({
   id:i===129?290:500+i,tripCode:i===129?'TRIP-LATE':'TRIP-'+i,tripName:i===129?'Later eligible trip':'Trip '+i,
   status:'DRAFT',departureTime:'2026-11-12T08:00:00',vehicleId:i===40?130:1,vehicleName:i===40?'Vehicle 130':'Vehicle 1',
   driverId:i===70?390:null,driverName:i===70?'Driver page three':null,
  }))
  const q=u.searchParams.get('search')?.toLowerCase()
  if(q)trips=trips.filter(t=>[t.tripCode,t.tripName].join(' ').toLowerCase().includes(q))
  if(u.searchParams.get('vehicleId'))trips=trips.filter(t=>String(t.vehicleId)===u.searchParams.get('vehicleId'))
  if(u.searchParams.get('driverId'))trips=trips.filter(t=>String(t.driverId)===u.searchParams.get('driverId'))
  return paged(trips,u)
 }

 let rows=[...requirementsFixture]
 const q=u.searchParams.get('search')?.trim().toLowerCase()
 if(q)rows=rows.filter(r=>[r.id,r.destination,r.customerName,r.tripCode].join(' ').toLowerCase().includes(q))
 const status=u.searchParams.get('status'),priority=u.searchParams.get('priority')
 if(status)rows=rows.filter(r=>(r.shortDelivered?'PARTIAL':r.status)===status)
 if(priority)rows=rows.filter(r=>r.priority===priority)
 if(u.searchParams.get('deadlineFrom'))rows=rows.filter(r=>r.deadline>=u.searchParams.get('deadlineFrom')!)
 if(u.searchParams.get('deadlineTo'))rows=rows.filter(r=>r.deadline<u.searchParams.get('deadlineTo')!)
 if(u.searchParams.get('sortBy')==='id'&&u.searchParams.get('sortDir')==='DESC')rows.reverse()
 return paged(rows,u)
}
