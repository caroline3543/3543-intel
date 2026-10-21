import {useState} from 'react';
import {addArenaResult,loadArenaResults,removeArenaResult} from '../services/arenaResultsService.js';
export function useArenaResults(stateId){
 const [results,setResults]=useState(()=>loadArenaResults(localStorage,stateId)),[message,setMessage]=useState('');
 function record(result){try{const next=addArenaResult(localStorage,stateId,results,result);setResults(next);setMessage('Battle result saved on this device.')}catch{setMessage('Could not save the battle result. Device storage may be full.')}}
 function remove(id){try{setResults(removeArenaResult(localStorage,stateId,results,id));setMessage('Battle result removed.')}catch{setMessage('Could not remove the battle result.')}}
 return {results,record,remove,message};
}
