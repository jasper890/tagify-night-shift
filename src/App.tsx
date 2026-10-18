import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Home from './pages/Home'

const Lesson1 = lazy(() => import('./pages/Lesson1'))
const Lesson2 = lazy(() => import('./pages/Lesson2'))
const Lesson3 = lazy(() => import('./pages/Lesson3'))
const Lesson4 = lazy(() => import('./pages/Lesson4'))
const Lesson5 = lazy(() => import('./pages/Lesson5'))
const Lesson6 = lazy(() => import('./pages/Lesson6'))
const Lesson7 = lazy(() => import('./pages/Lesson7'))
const Lesson8 = lazy(() => import('./pages/Lesson8'))
const Beyond = lazy(() => import('./pages/Beyond'))
const BeyondTool = lazy(() => import('./pages/BeyondTool'))
const Cheatsheet = lazy(() => import('./pages/Cheatsheet'))
const Glossary = lazy(() => import('./pages/Glossary'))
const Summary = lazy(() => import('./pages/Summary'))
const Practice = lazy(() => import('./pages/Practice'))
const Terminal = lazy(() => import('./pages/Terminal'))
const Player = lazy(() => import('./pages/Player'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<p className="pixel-label animate-blink p-8 text-amber">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lesson/1" element={<Lesson1 />} />
          <Route path="/lesson/2" element={<Lesson2 />} />
          <Route path="/lesson/3" element={<Lesson3 />} />
          <Route path="/lesson/4" element={<Lesson4 />} />
          <Route path="/lesson/5" element={<Lesson5 />} />
          <Route path="/lesson/6" element={<Lesson6 />} />
          <Route path="/lesson/7" element={<Lesson7 />} />
          <Route path="/lesson/8" element={<Lesson8 />} />
          <Route path="/beyond" element={<Beyond />} />
          <Route path="/beyond/:tool" element={<BeyondTool />} />
          <Route path="/cheatsheet" element={<Cheatsheet />} />
          <Route path="/glossary" element={<Glossary />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/player" element={<Player />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/terminal/:track" element={<Terminal />} />
          <Route path="/demo" element={<Navigate to="/practice" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
