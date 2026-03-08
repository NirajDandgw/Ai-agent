import React from 'react';
import '../styles/Table.css';

const Table = ({ columns, data, onRowClick }) => {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index} className={column.className || ''}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="no-data">
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr 
                key={rowIndex} 
                onClick={() => onRowClick && onRowClick(row)}
                className={onRowClick ? 'clickable' : ''}
              >
                {columns.map((column, colIndex) => (
                  <td key={colIndex} className={column.className || ''}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;