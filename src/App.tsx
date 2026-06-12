import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'

// Code splitting : chaque page est chargée à la demande pour réduire le bundle
// initial (la landing ne télécharge plus tout le back-office).
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const ManagerDashboard = lazy(() => import('@/pages/manager/ManagerDashboard'))
const CreateChantier = lazy(() => import('@/pages/manager/CreateChantier'))
const TechnicienHome = lazy(() => import('@/pages/technicien/TechnicienHome'))
const GestionEquipe = lazy(() => import('@/pages/manager/GestionEquipe'))
const SignupPage = lazy(() => import('@/pages/SignupPage'))
const ChantierDetail = lazy(() => import('@/pages/ChantierDetail'))
const AnomaliesChantier = lazy(() => import('@/pages/anomalies/AnomaliesChantier'))
const ChecklistMateriel = lazy(() => import('@/pages/chantier/ChecklistMateriel'))
const AutoControle = lazy(() => import('@/pages/chantier/AutoControle'))
const EditChantier = lazy(() => import('@/pages/manager/EditChantier'))
const LandingPage = lazy(() => import('@/pages/LandingPage'))
const VTCreate = lazy(() => import('@/pages/VTCreate'))
const VTDetail = lazy(() => import('@/pages/VTDetail'))
const VTEdit = lazy(() => import('@/pages/VTEdit'))
const CGUPage = lazy(() => import('@/pages/CGUPage'))
const ConfidentialitePage = lazy(() => import('@/pages/ConfidentialitePage'))
const UpgradeSuccessPage = lazy(() => import('@/pages/UpgradeSuccessPage'))
// Prototype isolé (URL cachée, aucun lien dans l'app) — à retirer après validation
const ProtoCroquis = lazy(() => import('@/pages/ProtoCroquis'))

// Même spinner que le chargement initial dans index.html
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
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

            {/* Visites Techniques */}
            <Route path="/vt/nouvelle" element={<ProtectedRoute><VTCreate /></ProtectedRoute>} />
            <Route path="/vt/:id/modifier" element={<ProtectedRoute><VTEdit /></ProtectedRoute>} />
            <Route path="/vt/:id" element={<ProtectedRoute><VTDetail /></ProtectedRoute>} />

            {/* Technicien */}
            <Route path="/technicien" element={
              <ProtectedRoute allowedRole="technicien"><TechnicienHome /></ProtectedRoute>
            } />

            <Route path="/" element={<LandingPage />} />
            <Route path="/cgu" element={<CGUPage />} />
            <Route path="/confidentialite" element={<ConfidentialitePage />} />
            <Route path="/upgrade/success" element={<UpgradeSuccessPage />} />
            <Route path="/proto-croquis" element={<ProtoCroquis />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
