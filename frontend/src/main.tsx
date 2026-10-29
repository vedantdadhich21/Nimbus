import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './lib/bytes-polyfill'
import App from './App'
import { ThemeProvider } from './lib/theme'
import { ToastProvider } from './components/ui'
import { UploadProvider } from './lib/uploads'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, refetchOnWindowFocus: false, retry: false },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <ToastProvider>
        <UploadProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </UploadProvider>
      </ToastProvider>
    </ThemeProvider>
  </QueryClientProvider>,
)
