import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/pages/Dashboard';
import JobDetail from './components/pages/JobDetail';
import Header from './components/Header';
import './styles/App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/job/:id" element={<JobDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;