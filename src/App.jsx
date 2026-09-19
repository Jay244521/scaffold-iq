import React, { useState } from 'react';

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    padding: '24px',
    background: '#1C3D2E',
    color: '#F4F7F5',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    textAlign: 'center',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 700,
    margin: 0,
  },
  tagline: {
    fontSize: '1.1rem',
    color: '#B9CFC2',
    margin: 0,
    maxWidth: '32rem',
  },
  roleRow: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  button: {
    padding: '12px 28px',
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: '999px',
    border: '2px solid #F4F7F5',
    background: 'transparent',
    color: '#F4F7F5',
    cursor: 'pointer',
  },
  buttonActive: {
    background: '#F4F7F5',
    color: '#1C3D2E',
  },
  status: {
    fontSize: '0.95rem',
    color: '#B9CFC2',
  },
};

function App() {
  const [role, setRole] = useState(null);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Scaffold-IQ</h1>
      <p style={styles.tagline}>
        The student and teacher workspace is under construction. Pick a role to preview
        where each portal will live.
      </p>
      <div style={styles.roleRow}>
        <button
          type="button"
          style={{ ...styles.button, ...(role === 'student' ? styles.buttonActive : {}) }}
          onClick={() => setRole('student')}
        >
          I'm a Student
        </button>
        <button
          type="button"
          style={{ ...styles.button, ...(role === 'teacher' ? styles.buttonActive : {}) }}
          onClick={() => setRole('teacher')}
        >
          I'm a Teacher
        </button>
      </div>
      {role && (
        <p style={styles.status}>
          {role === 'student' ? 'Student portal' : 'Teacher dashboard'} coming soon.
        </p>
      )}
    </div>
  );
}

export default App;
