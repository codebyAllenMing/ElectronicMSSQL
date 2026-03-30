import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles/globals.css'
import App from './app'
import childRoutes from './components/child/child-routes'

const params = new URLSearchParams(window.location.search)
const childRoute = params.get('child')

function Root(): JSX.Element {
    if (childRoute) {
        const ChildComponent = childRoutes[childRoute]
        if (ChildComponent) {
            return (
                <div className="dark">
                    <ChildComponent />
                </div>
            )
        }
        return <div className="p-4 text-red-500">Unknown route: {childRoute}</div>
    }
    return <App />
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Root />
    </StrictMode>
)
