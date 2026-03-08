import React from 'react';
import '../styles/Loader.css';

const Loader = ({ message = 'Loading...' }) => {
  return (
    <div className="loader-container">
      <div className="loader-spinner"></div>
      <p className="loader-message">{message}</p>
    </div>
  );
};

export default Loader;