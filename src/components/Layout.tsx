import React, { useCallback, useEffect, useReducer, useRef, useState, type HTMLAttributes } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { registerShortcut } from "../utils/shortcutRegistry";
import { WalletConnectButton } from "./Wallet/WalletConnectButton";
import MobileDrawer from "./MobileDrawer";
import NavLink from "./NavLink";
import { Text } from "./Text";
import { TrustlineBanner } from "./TrustlineBanner";
import { ConnectivityBanner } from "./ConnectivityBanner";
import { initConnectivityListeners } from "../services/connectivity";
import NotificationBell from "./Notification/NotificationBell";
import { ShortcutsHelp } from "./ShortcutsHelp";
import ErrorBoundary from "./ErrorBoundary";
import { ToastViewport } from "./ToastViewport";
import ThemeToggle from "./ThemeToggle";
import LanguageSelector from "./LanguageSelector";
import { useT } from "../i18n";
import CommandPalette from "./CommandPalette";
import { useOptionalWallet } from "../context/WalletContext";
import {
  DRAWER_INITIAL_STATE,
  isDrawerOpen,
  reduceDrawerState,
  shouldCloseDrawerOnRouteChange,
} from "../utils/drawerState";
import { useBreakpoint } from "../utils/useBreakpoint";
import RouteAnnouncer from "./RouteAnnouncer";
import { useScrollRestoration } from "../hooks/useScrollRestoration";
import { usePushDelivery } from "../notifications/usePushDelivery";
import { hasActiveNavigationGuard } from "../utils/navigationGuard";
import { ConfirmationModal } from "./ConfirmationModal";
import "./Layout.css";

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * The drawer is a mobile-only surface driven by a pure reducer. The
 * invariants this component must preserve are:
 *
 * 1. All transitions go through `reduceDrawerState`, so open/close/toggle
 *    and recovery events are deterministic and idempotent.
 * 2. Route changes close the drawer only when the pathname actually
 *    changed, guarded by `shouldCloseDrawerOnRouteChange`.
 * 3. Crossing into the desktop breakpoint forces the drawer closed so the
 *    scroll lock is never left engaged behind a hidden drawer.
 * 4. When the drawer is open, the rest of the app is hidden from assistive
 *    technology and inert, so focus can never escape into background content.
 */

function isValidPathname(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.startsWith("/");
}

export default function Layout({ children }: LayoutProps) {
  const t = useT();
  const wallet = useOptionalWallet();
  const isDemo = wallet?.isDemo ?? false;
  const resetDemo = wallet?.resetDemo ?? (() => {});
  // All drawer transitions flow through the reducer so open/close/toggle and
  // the route-change/resize recovery events are deterministic and idempotent
  // (see src/utils/drawerState.ts for the state machine and its invariants).
  const [drawerState, dispatchDrawer] = useReducer(
    reduceDrawerState,
    DRAWER_INITIAL_STATE,
  );
  const drawerIsOpen = isDrawerOpen(drawerState);
  const closeDrawer = useCallback(() => dispatchDrawer({ type: "CLOSE" }), []);
  const toggleDrawer = () => dispatchDrawer({ type: "TOGGLE"});
  const location = useLocation();
  const focusPathnameRef = useRef(location.pathname);
  useScrollRestoration();
  const navigate = useNavigate();

  useEffect(() => {
    const unregisterGd = registerShortcut({
      keys: "g d",
      description: "Go to Dashboard",
      handler: () => navigate("/dashboard"),
    });
    const unregisterGv = registerShortcut({
      keys: "g v",
      description: "Go to Vaults",
      handler: () => navigate("/vaults"),
    });
    const unregisterGq = registerShortcut({
      keys: "g q",
      description: "Go to Verifier Queue",
      handler: () => navigate("/verifier/queue"),
    });
    const unregisterGh = registerShortcut({
      keys: "g h",
      description: "Go to Help",
      handler: () => navigate("/help"),
    });
    const unregisterC = registerShortcut({
      keys: "c",
      description: "Create Vault",
      handler: () => navigate("/vaults/create"),
    });

    return () => {
      unregisterGd();
      unregisterGv();
      unregisterGq();
      unregisterGh();
      unregisterC();
    };
  }, [navigate]);

  // Announce demo mode activation for assistive tech
  const [announcedDemo, setAnnouncedDemo] = React.useState(false);
  useEffect(() => {
    if (isDemo && !announcedDemo) {
      setAnnouncedDemo(true);
    } else if (!isDemo && announcedDemo) {
      setAnnouncedDemo(false);
    }
  }, [isDemo, announcedDemo]);

  useEffect(() => {
    initConnectivityListeners();
  }, []);

  // Push delivery is mounted exactly once, here: a single subscriber owns the
  // notification store diff and the OS notification queue for the whole app.
  usePushDelivery();

  // Deep-link / navigation recovery: close the drawer whenever the route
  // actually changes (in-app navigation, browser back/forward, deep links).
  // Guarded by shouldCloseDrawerOnRouteChange so a stale location object with
  // an unchanged pathname can never close a freshly opened drawer.
  //
  // The previous pathname is normalized through `isValidPathname` so a
  // malformed location (e.g. a missing or non-string pathname from a custom
  // router or a test double) is treated as a new route rather than silently
  // leaving the drawer open or closing it under stale state.
  const prevPathnameRef = useRef<string | null>(
    isValidPathname(location.pathname) ? location.pathname : null,
  );
  useEffect(() => {
    const prevPathname = prevPathnameRef.current;
    const nextPathname = isValidPathname(location.pathname)
      ? location.pathname
      : null;
    prevPathnameRef.current = nextPathname;

    // A malformed pathname is a failure path: we treat it as a route change
    // so the drawer cannot remain open over unknown content, but we never
    // dispatch a close when both sides are unknown (idempotent no-op).
    if (prevPathname === null && nextPathname === null) {
      return;
    }
    if (prevPathname === null || nextPathname === null) {
      dispatchDrawer({ type: "ROUTE_CHANGE" });
      return;
    }
    if (shouldCloseDrawerOnRouteChange(prevPathname, nextPathname)) {
      dispatchDrawer({ type: "ROUTE_CHANGE" });
    }
  }, [location.pathname]);

  // Resize recovery: the drawer is a mobile-only surface. When the viewport
  // crosses into the desktop breakpoint (768px+), close the drawer and release
  // the scroll lock so the desktop nav is never trapped behind a hidden drawer.
  const isDesktop = useBreakpoint("md");
  useEffect(() => {
    if (isDesktop) {
      dispatchDrawer({ type: "RESIZE_DESKTOP" });
    }
  }, [isDesktop]);

  // Failure path: a drawer that is open while the viewport is already desktop
  // would leave the scroll lock engaged with no way to close it via the
  // mobile hamburger. The reducer is the source of truth, but we also derive
  // the effective open state from `isDesktop` so a stale open state can never
  // be observed by the DOM or by the assistive technology hiding logic.
  const effectiveDrawerIsOpen = drawerIsOpen && !isDesktop;

  const backgroundAccessibilityProps = effectiveDrawerIsOpen
    ? ({ "aria-hidden": true, inert: "" } as HTMLAttributes<HTMLElement> & {
        inert: "";
      })
    : {};

  // The hamburger is only meaningful on mobile. On desktop it is hidden by CSS,
  // but we also disable it so a keyboard user cannot open a drawer that the
  // viewport will immediately force closed.
  const hamburgerDisabled = isDesktop;

  useEffect(() => {
    const pathnameChanged = focusPathnameRef.current !== location.pathname;
    focusPathnameRef.current = location.pathname;
    if (!pathnameChanged || document.querySelector('[role="dialog"], [aria-modal="true"]')) return
    document.getElementById("main-content")?.focus({ preventScroll: true })
  }, [location.pathname]);
  // Unsaved-changes navigation guard.
  //
  // The app renders a declarative <BrowserRouter>, so `useBlocker` (data
  // routers only) is unavailable. Instead, a page with unsaved state
  // registers a guard (src/utils/navigationGuard.ts) and this capture-phase
  // listener asks for confirmation before any internal link is followed.
  // Capture phase + preventDefault is what stops React Router's <Link> from
  // navigating, without touching every link in the tree.
  // (`navigate` is declared above for the keyboard shortcuts.)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!hasActiveNavigationGuard()) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("target")) return;

      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      // Re-clicking the current page is not a navigation worth blocking.
      if (href === `${location.pathname}${location.search}`) return;

      event.preventDefault();
      setPendingNavigation(href);
    };

    document.addEventListener("click", handleLinkClick, true);
    return () => document.removeEventListener("click", handleLinkClick, true);
  }, [location.pathname, location.search]);

  const handleConfirmNavigation = () => {
    const href = pendingNavigation;
    setPendingNavigation(null);
    if (href) navigate(href);
  };

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById("main-content")?.focus()
        }}
      >
        {t("nav.skipToMain")}
      </a>
      <RouteAnnouncer />
      <div className="sr-only" aria-live="polite" role="status">
        {isDemo ? "Demo mode active: changes stay in this browser" : ""}
      </div>
      <header className="site-header">
        <div className="header-brand" {...backgroundAccessibilityProps}>
          <Link to="/" className="header-link" aria-label={t("nav.brandAria")}>
            <Text role="title" as="span">
              Disciplr
            </Text>
          </Link>
          <NavLink
            to="/transactions"
            className="header-link"
            ariaLabel={t("nav.transactions")}
          >
            <span className="header-transactions-label">{t("nav.transactions")}</span>
            <span
              aria-hidden="true"
              className="header-transactions-icon"
            >
              ↗
            </span>
          </NavLink>
        </div>

        <nav
          className="desktop-nav"
          aria-label={t("nav.mainAria")}
          {...backgroundAccessibilityProps}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <NavLink
              to="/"
              className="header-link"
              aria-current={location.pathname === "/" ? "page" : undefined}
            >
              <Text role="caption" as="span">
                {t("nav.home")}
              </Text>
            </NavLink>

            <NavLink to="/dashboard" className="header-link">
              <Text role="caption" as="span">
                {t("nav.dashboard")}
              </Text>
            </NavLink>

            <NavLink
              to="/vaults"
              className="header-link"
              aria-current={
                // "Create Vault" is its own top-level nav item with an exact
                // match below, so it must not also count as "Vaults" being
                // active (otherwise two nav links would both be "current").
                location.pathname.startsWith("/vaults") &&
                location.pathname !== "/vaults/create"
                  ? "page"
                  : undefined
              }
            >
              <Text role="caption" as="span">
                {t("nav.vaults")}
              </Text>
            </NavLink>

            <NavLink to="/verifier" className="header-link">
              <Text role="caption" as="span">
                {t("nav.verifier")}
              </Text>
            </NavLink>

            <NavLink
              to="/analytics"
              className="header-link"
              aria-current={
                location.pathname === "/analytics" ? "page" : undefined
              }
            >
              <Text role="caption" as="span">
                {t("nav.analytics")}
              </Text>
            </NavLink>

            <NavLink to="/docs" className="header-link">
              <Text role="caption" as="span">
                {t("nav.docs")}
              </Text>
            </NavLink>

            <NavLink
              to="/help"
              className="header-link"
              aria-current={location.pathname.startsWith('/help') ? 'page' : undefined}
            >
              <Text role="caption" as="span">
                {t("nav.help")}
              </Text>
            </NavLink>

            <Link
              to="/vaults/create"
              className="header-link header-cta"
              aria-current={
                location.pathname === "/vaults/create" ? "page" : undefined
              }
            >
              {t("nav.createVault")}
            </Link>
            <CommandPalette />
            <NotificationBell />
            <LanguageSelector />
            <ThemeToggle />
            {isDemo && (
              <div className="demo-mode-chip desktop-demo-chip" role="status" aria-label="Demo mode">
                <span className="demo-mode-chip-text">
                  Demo mode: changes stay in this browser
                </span>
                <button
                  type="button"
                  className="demo-mode-reset-btn"
                  onClick={resetDemo}
                  title="Clear demo data and reset to initial demo state"
                  aria-label="Reset demo"
                >
                  Reset demo
                </button>
              </div>
            )}
            <WalletConnectButton />
          </div>
        </nav>
        <div className="mobile-bell-wrapper" {...backgroundAccessibilityProps}>
          <NotificationBell />
          <ThemeToggle />
        </div>
        <button
          type="button"
          className="mobile-hamburger"
          aria-label={t("nav.openMenu")}
          aria-controls="mobile-drawer"
          aria-expanded={effectiveDrawerIsOpen}
          disabled={hamburgerDisabled}
          onClick={toggleDrawer}
        >
          <Menu size={24} aria-hidden="true" />
        </button>
        <MobileDrawer isOpen={effectiveDrawerIsOpen} onClose={closeDrawer} />
      </header>
      <ConnectivityBanner />
      {isDemo && (
        <div className="mobile-demo-banner" role="status">
          <span>Demo mode: changes stay in this browser</span>
          <button
            type="button"
            className="demo-mode-reset-btn"
            onClick={resetDemo}
            aria-label="Reset demo"
          >
            Reset demo
          </button>
        </div>
      )}
      <TrustlineBanner />

      <main
        id="main-content"
        tabIndex={-1}
        {...backgroundAccessibilityProps}
        style={{
          flex: 1,
          padding: "var(--spacing-8)",
          maxWidth: "var(--container-standard)",
          margin: "0 auto",
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        {/*
          Backstop boundary around <main>. Layout never unmounts, so without
          `resetKeys` a crash here would leave every subsequent route showing
          the fallback until a full reload. Keying on the pathname clears it
          as soon as the user navigates.
        */}
        <ErrorBoundary resetKeys={[location.pathname]}>{children}</ErrorBoundary>
      </main>
      <footer
        {...backgroundAccessibilityProps}
        style={{
          padding: "var(--spacing-4, 1rem) var(--spacing-8, 2rem)",
          textAlign: "center",
          fontSize: "0.875rem",
          opacity: 0.85,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0.5rem 1.25rem",
        }}
      >
        <a href="https://github.com/Disciplr-Org/Disciplr-Frontend" target="_blank" rel="noopener noreferrer">
          {t("footer.github")}
        </a>
        <a href="https://disciplr-frontend-alpha.vercel.app" target="_blank" rel="noopener noreferrer">
          {t("footer.liveDemo")}
        </a>
        <Link to="/docs">{t("footer.docs")}</Link>
      </footer>
      <ShortcutsHelp />
      <ToastViewport />
      {pendingNavigation !== null && (
        <ConfirmationModal
          isOpen
          onClose={() => setPendingNavigation(null)}
          onConfirm={handleConfirmNavigation}
          simpleConfirm={{
            title: "Leave this page?",
            message:
              "You have unsaved changes on this page. Your draft is saved locally, but you will need to restore it when you come back.",
            confirmLabel: "Leave page",
          }}
        />
      )}
    </div>
  );
}
