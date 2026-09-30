import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import 'json-glance/styles.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('The playground root element is missing.');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
