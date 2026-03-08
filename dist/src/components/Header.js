import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <div className="logo-icon">CM</div>
          <div className="logo-text">
            <h1>Control-M Smart RCA</h1>
            <span>AI-Powered Job Monitoring</span>
          </div>
        </Link>
        <nav className="nav">
          <Link to="/" className="nav-link">Dashboard</Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;