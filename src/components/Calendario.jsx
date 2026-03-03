import React, { useState } from 'react';
import './Calendario.css';

const Calendario = () => {
  const [selectedCell, setSelectedCell] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Generar días de la semana actual
  const getDaysOfWeek = () => {
    const days = [];
    const startOfWeek = new Date(currentWeek);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Lunes

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Generar horas del día
  const hours = [];
  for (let i = 0; i < 24; i++) {
    hours.push(`${i}:00`);
  }

  const handleCellClick = (fecha, hora) => {
    setSelectedCell({ fecha: fecha.toISOString(), hora });
  };

  const formatDate = (date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
    const month = monthNames[date.getMonth()];
    return `${day} ${month}`;
  };

  const getDayName = (date) => {
    const dayNames = ['dom.', 'lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.'];
    return dayNames[date.getDay()];
  };

  const daysOfWeek = getDaysOfWeek();

  return (
    <div className="calendario-container">
      <div className="calendario-header">
        <button onClick={() => {
          const newWeek = new Date(currentWeek);
          newWeek.setDate(newWeek.getDate() - 7);
          setCurrentWeek(newWeek);
        }}>Anterior</button>
        <button onClick={() => setCurrentWeek(new Date())}>Hoy</button>
        <button onClick={() => {
          const newWeek = new Date(currentWeek);
          newWeek.setDate(newWeek.getDate() + 7);
          setCurrentWeek(newWeek);
        }}>Siguiente</button>
      </div>

      <div className="calendario-grid">
        <div className="time-column">
          <div className="header-cell"></div>
          {hours.map(hora => (
            <div key={hora} className="time-cell">{hora}</div>
          ))}
        </div>

        {daysOfWeek.map((day, index) => (
          <div key={index} className="day-column">
            <div className="header-cell">
              <div>{formatDate(day)} {getDayName(day)}</div>
            </div>
            {hours.map(hora => (
              <div
                key={`${day}-${hora}`}
                className={`calendar-cell ${
                  selectedCell?.fecha === day.toISOString() && selectedCell?.hora === hora
                    ? 'selected'
                    : ''
                }`}
                onClick={() => handleCellClick(day, hora)}
              >
                {/* Aquí irían las citas programadas */}
              </div>
            ))}
          </div>
        ))}
      </div>

      {selectedCell && (
        <div className="selected-info">
          Seleccionado: {new Date(selectedCell.fecha).toLocaleDateString()} a las {selectedCell.hora}
        </div>
      )}
    </div>
  );
};

export default Calendario;