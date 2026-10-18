import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { motion } from "motion/react";
import type { Site } from "~/shared/types";
const navigation = [
  ["/#services", "Чем помогу"],
  ["/experience", "Опыт и стек"],
  ["/about", "Обо мне"],
];
export function Shell({
  site,
  children,
}: {
  site: Site;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  return (
    <>
      <a className="skip-link" href="#main">
        К содержимому
      </a>
      <header className="site-header container">
        <Link to="/" className="wordmark" onClick={() => setOpen(false)}>
          {site.name}
          <span>.</span>
          <small>BACKEND DEVELOPER</small>
        </Link>
        <nav className="desktop-nav" aria-label="Основная навигация">
          {navigation.map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
          <Link to="/contact" className="nav-contact">
            Обсудить проект <ArrowUpRight size={15} />
          </Link>
        </nav>
        <button
          className="menu-toggle"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      {open && (
        <motion.nav
          id="mobile-navigation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mobile-nav"
          aria-label="Мобильная навигация"
        >
          {[
            ["/", "Главная"],
            ...navigation,
            ["/contact", "Обсудить проект"],
          ].map(([to, label]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)}>
              {label}
              <ArrowUpRight size={20} />
            </Link>
          ))}
        </motion.nav>
      )}
      <main id="main" key={location.pathname}>
        {children}
      </main>
      <footer className="site-footer container">
        <div className="footer-main">
          <Link to="/" className="footer-brand">
            {site.name}
            <span>.</span>
          </Link>
          <p>
            {site.profession}
            <br />
            {site.city}
          </p>
        </div>
        <div className="footer-links">
          <Link to="/experience">Опыт и стек</Link>
          <Link to="/about">Обо мне</Link>
          <Link to="/contact">
            Связаться <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getUTCFullYear()} {site.name}
          </span>
          <div>
            <Link to="/privacy">Конфиденциальность</Link>
            <Link to="/studio">Кабинет</Link>
          </div>
          {site.demo_mode && (
            <span className="preview-label">Предпросмотр</span>
          )}
        </div>
      </footer>
    </>
  );
}
