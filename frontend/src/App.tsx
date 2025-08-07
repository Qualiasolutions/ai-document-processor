import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { LandingPage } from './pages/LandingPage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { QualiaHeader } from './components/QualiaHeader'
import './App.css'

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="App min-h-screen bg-gray-50">
          <QualiaHeader />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="*" element={<LandingPage />} />
          </Routes>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </div>
      </Router>
    </ErrorBoundary>
  )
}

export default App