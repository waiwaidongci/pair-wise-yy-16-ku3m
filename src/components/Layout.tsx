import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { SyncCenter } from './SyncCenter';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/work', label: 'Work', end: false },
  { to: '/about', label: 'About', end: false },
  { to: '/contact', label: 'Contact', end: false },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          林屿<em> · </em>摄影
        </Link>

        <nav className={`nav-links ${open ? 'open' : ''}`}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <SyncCenter />
          <button
            className={`nav-toggle ${open ? 'open' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-label="切换菜单"
            aria-expanded={open}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span className="brand">
          林屿<em> · </em>摄影
        </span>
        <span>© {new Date().getFullYear()} 独立摄影师作品集 · 本地覆盖层编排，原始素材只读</span>
      </div>
    </footer>
  );
}
