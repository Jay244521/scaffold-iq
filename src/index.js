import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import LeadMachine from './LeadMachine';

const isLeadMachine = window.location.pathname.replace(/\/+$/, '') === '/lead-machine';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isLeadMachine ? <LeadMachine /> : <App />}
  </React.StrictMode>
);
