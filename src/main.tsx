import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// Language initialization removed to avoid side effects.

import { PopupRoot } from './components/PopupRoot';
import { ErrorBoundary } from './components/ErrorBoundary';

const container = document.getElementById('root')!;
const root = ReactDOM.createRoot(container);

if (window.location.hash.startsWith('#/popup/')) {
    root.render(
        <React.StrictMode>
            <PopupRoot />
        </React.StrictMode>
    );
} else {
    root.render(
        <React.StrictMode>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </React.StrictMode>
    );
}
