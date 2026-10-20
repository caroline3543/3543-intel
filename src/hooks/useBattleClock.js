import {useEffect,useState} from 'react';
export function useBattleClock() {
  const [now,setNow]=useState(()=>Math.floor(Date.now()/1000));
  const [warning,setWarning]=useState('Device clock unverified. Check UTC before battle.');
  useEffect(()=>{
    let wall=Date.now(),mono=performance.now();
    const tick=()=>{const w=Date.now(),m=performance.now();if(Math.abs((w-wall)-(m-mono))>2000)setWarning('Clock changed. Review timing.');wall=w;mono=m;setNow(Math.floor(w/1000));};
    const resume=()=>{if(!document.hidden){tick();setWarning('Returned to foreground. Verify UTC and reported timings.');}};
    const timer=setInterval(tick,250);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
    return()=>{clearInterval(timer);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
  },[]);
  return {now,warning};
}
