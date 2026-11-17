/** Provider timestamps are distinct from the moment the app requested data. */
const dateValue=value=>{if(!value)return null;const d=new Date(typeof value==='number'&&value<1e12?value*1000:value);return Number.isNaN(d.getTime())?null:d;};
const display=value=>{const d=dateValue(value);return d?d.toLocaleString():'Not supplied by provider';};
export function describeFreshness(response){
  const data=response?.data||{};
  const meta=data.meta||data.cache||response?.meta||{};
  const captured=meta.cached_at??data.cached_at??meta.captured_at??data.captured_at??null;
  const checked=response?.retrieved_at??new Date().toISOString();
  const refresh=meta.refresh??data.refresh??{};
  const state=typeof refresh==='string'?refresh:refresh.status??refresh.state??'';
  const retry=meta.retry_after??data.retry_after??refresh.retry_after??null;
  const updating=/pending|queued|running|updating|refreshing/i.test(String(state));
  const fresh=meta.fresh??data.fresh;
  const label=updating?'Updating':fresh===true?'Fresh':captured?'Cached / freshness unverified':'Freshness unknown';
  return {label,captured:display(captured),checked:display(checked),retry:retry?display(retry):'Not provided',detail:updating?'The provider is updating its stored data. This response may contain older information.':fresh===true?'The provider reports this data as fresh.':'A completed request does not prove that the game data was captured again.'};
}
