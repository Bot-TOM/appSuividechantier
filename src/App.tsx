import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import ManagerDashboard from '@/pages/manager/ManagerDashboard'
import CreateChantier from '@/pages/manager/CreateChantier'
import TechnicienHome from '@/pages/technicien/TechnicienHome'
import GestionEquipe from '@/pages/manager/GestionEquipe'
import SignupPage from '@/pages/SignupPage'
import ChantierDetail from '@/pages/ChantierDetail'
import AnomaliesChantier from '@/pages/anomalies/AnomaliesChantier'
import ChecklistMateriel from '@/pages/chantier/ChecklistMateriel'
import AutoControle from '@/pages/chantier/AutoControle'
import EditChantier from '@/pages/manager/EditChantier'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Manager */}
          <Route path="/manager" element={
            <ProtectedRoute allowedRole="manager"><ManagerDashboard /></ProtectedRoute>
          } />
          <Route path="/manager/nouveau-chantier" element={
            <ProtectedRoute allowedRole="manager" permissionKey="creer_chantier"><CreateChantier /></ProtectedRoute>
          } />
          <Route path="/manager/equipe" element={
            <ProtectedRoute allowedRole="manager"><GestionEquipe /></ProtectedRoute>
          } />

          {/* Détail chantier — accessible manager ET technicien */}
          <Route path="/chantier/:id" element={
            <ProtectedRoute><ChantierDetail /></ProtectedRoute>
          } />
          <Route path="/chantier/:id/anomalies" element={
            <ProtectedRoute><AnomaliesChantier /></ProtectedRoute>
          } />
          <Route path="/chantier/:id/materiel" element={
            <ProtectedRoute><ChecklistMateriel /></ProtectedRoute>
          } />
          <Route path="/chantier/:id/modifier" element={
            <ProtectedRoute allowedRole="manager" permissionKey="modifier_chantier"><EditChantier /></ProtectedRoute>
          } />
          <Route path="/chantier/:id/autocontrole" element={
            <ProtectedRoute><AutoControle /></ProtectedRoute>
          } />

          {/* Technicien */}
          <Route path="/technicien" element={
            <ProtectedRoute allowedRole="technicien"><TechnicienHome /></ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
