import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from "./pages/Login.jsx";
import Users from './pages/Users';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Coverage from './pages/Coverage';
import Employees from './pages/Employees';
import Schedule from './pages/Schedule';
import Financial from './pages/Financial';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/usuarios" element={<Users />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/financeiro" element={<Financial />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/cobertura" element={<Coverage />} />
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;