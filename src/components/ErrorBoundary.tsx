import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Filet de sécurité global : si un composant React plante, on affiche un
 * écran d'erreur propre avec un bouton de rechargement au lieu d'une page blanche.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary :', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-7 h-7 text-orange-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Une erreur est survenue
          </h1>
          <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
            Quelque chose s'est mal passé. Rechargez la page pour reprendre —
            vos données sont sauvegardées.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-md shadow-orange-500/20"
          >
            <RefreshCw className="w-4 h-4" />
            Recharger la page
          </button>
        </div>
      </div>
    )
  }
}
