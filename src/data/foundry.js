import { C } from '../utils/constants.js';
export const TEAM_COLORS = [C.blue,C.green,C.gold,C.mar,C.inf,C.lan,C.red,C.icy];
export const BUILDINGS = [
 ['boiler','Boiler Room',30,12],['repair4','Repair Facility IV',70,12],
 ['mercenary','Mercenary Camp',50,26],['prototype1','Prototype Site I',23,40],
 ['repair2','Repair Facility II',80,46],['imperial','Imperial Foundry',50,48],
 ['repair1','Repair Facility I',15,57],['prototype2','Prototype Site II',72,63],
 ['munitions','Munitions Warehouse',43,75],['repair3','Repair Facility III',30,90],
 ['transit','Central Transit Station',64,90],
 ['workshopNW','Workshop NW',12,25],['workshopNE','Workshop NE',87,25],
 ['workshopSW','Workshop SW',12,77],['workshopSE','Workshop SE',87,77],
].map(([id,name,x,y])=>({id,name,x,y}));
export const PHASES = ['Opening','Centre contest','Late battle'];
export const buildingName = id => BUILDINGS.find(b=>b.id===id)?.name || id;
