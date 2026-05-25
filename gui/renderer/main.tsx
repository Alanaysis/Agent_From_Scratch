import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/layout.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<div style="color:red;padding:20px;">Error: #root element not found</div>';
} else {
  try {
    const root = ReactDOM.createRoot(rootEl);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    rootEl.innerHTML = `<pre style="color:red;padding:20px;">${err}</pre>`;
  }
}
