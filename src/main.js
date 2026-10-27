import { createApp } from 'vue'
import App from './App.vue'
import './assets/index.css'
import './assets/industry.css'

const app = createApp(App)
app.mount('#app')

// Installable app + phone push alerts (see public/sw.js)
if ('serviceWorker' in navigator) {
  const registerServiceWorker = () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker not registered:', err))
  }
  if (document.readyState === 'complete') registerServiceWorker()
  else window.addEventListener('load', registerServiceWorker)
}
