import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Workspace from './pages/Workspace';
import HelloCompose from './pages/HelloCompose';

export default function App() {
  return (
    <BrowserRouter>
      <div className="p-4 max-w-4xl mx-auto">
        <nav className="mb-4 flex gap-3 text-sm">
          <Link to="/workspace" className="underline">Workspace</Link>
          <Link to="/hello" className="underline">Hello</Link>
        </nav>
        <Routes>
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/hello" element={<HelloCompose />} />
          <Route path="*" element={<Navigate to="/workspace" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
