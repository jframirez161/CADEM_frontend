// Example for src/main.jsx (Vite)
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // Ensure this points to App.jsx if it was App.js
import './style.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)