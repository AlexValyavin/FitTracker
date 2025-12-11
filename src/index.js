import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// ВАЖНО: Добавьте этот импорт!
import * as serviceWorkerRegistration from './serviceWorkerRegistration'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ВАЖНО: Поменяйте unregister() на register()
serviceWorkerRegistration.register();