import React from 'react';
import {createRoot} from 'react-dom/client';
import {initializeRosterStorage,appStorage,flushRosterStorage} from '../../src/services/rosterStorageService.js';
import {initializeWorkspaces,getWorkspaces} from '../../src/services/stateWorkspaceService.js';
import {SiteApp} from './site.jsx';
async function start(){
  await initializeRosterStorage();initializeWorkspaces(appStorage,'3739');getWorkspaces();await flushRosterStorage();
  createRoot(document.getElementById('root')).render(<SiteApp/>);
}
start().catch(()=>{document.getElementById('root').textContent='Unable to open saved roster data. Close other tabs for this site and reload.';});
