import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { OverlayProvider } from './overlay/OverlayProvider';
import { LightboxProvider } from './state/lightboxStore';
import { Nav, Footer } from './components/Layout';
import { Lightbox } from './components/Lightbox';
import { Home } from './pages/Home';
import { Work } from './pages/Work';
import { Series } from './pages/Series';
import { About } from './pages/About';
import { Contact } from './pages/Contact';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <OverlayProvider>
      <LightboxProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Nav />
          <main style={{ minHeight: '60vh' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/work" element={<Work />} />
              <Route path="/work/:seriesId" element={<Series />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </main>
          <Footer />
          <Lightbox />
        </BrowserRouter>
      </LightboxProvider>
    </OverlayProvider>
  );
}
