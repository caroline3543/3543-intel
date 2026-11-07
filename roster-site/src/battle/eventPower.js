import {parsePower} from '../tal/power.js';
export function battlePower(member){try{return parsePower(member.power);}catch{return null;}}
