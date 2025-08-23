import React from 'react'
import { createRoot } from 'react-dom/client'
import AdminApp from './AdminApp'
import '../index.css' // on réutilise ton CSS (tailwind déjà configuré)

createRoot(document.getElementById('admin')).render(<AdminApp />)
