import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Brands from './pages/Brands'
import ExcelMapping from './pages/ExcelMapping'
import Products from './pages/Products'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="marcas" element={<Brands />} />
        <Route path="excel" element={<ExcelMapping />} />
        <Route path="produtos" element={<Products />} />
        <Route path="configuracoes" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default App
