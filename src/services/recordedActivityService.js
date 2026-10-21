export function recordedTimestamp(value){
 if(typeof value==='number' || (typeof value==='string' && /^\d+(?:\.\d+)?$/.test(value.trim()))){
  const n=Number(value);if(!Number.isFinite(n) || n<=0)return null;
  const ms=n<1e11?n*1000:n;return Number.isFinite(new Date(ms).getTime())?new Date(ms).toISOString():null;
 }
 if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
 const date=new Date(value);return Number.isFinite(date.getTime())?date.toISOString():null;
}
export function recordedActivity(value,now=Date.now()){
 const iso=recordedTimestamp(value);if(!iso)return null;
 const diff=now-Date.parse(iso),minutes=Math.floor(Math.abs(diff)/60000),hours=Math.floor(minutes/60),days=Math.floor(hours/24);
 const duration=days?`${days}d ${hours%24}h`:hours?`${hours}h ${minutes%60}m`:minutes?`${minutes}m`:'less than 1m';
 return {iso,utc:iso.slice(0,19).replace('T',' ')+' UTC',relative:diff>=0?`${duration} ago`:`${duration} in the future`};
}
