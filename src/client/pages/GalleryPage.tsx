// ============================================================================
// GitHoot Gallery of Guardians Page (src/client/pages/GalleryPage.tsx)
// Public Hatched Companions Showcase with Search, Filter, Sort & Keyset Paging
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { GalleryItem, GalleryResponse, GallerySort, RarityTier } from '../../server/types';
import { VALID_GALLERY_ELEMENTS, VALID_GALLERY_RARITIES } from '../../server/types';
import { GuardianGalleryCard, RARITY_COLORS } from '../components/GuardianGalleryCard';

export interface GalleryPageProps {
  onRouteChange: (route: string) => void;
}

export const GalleryPage: React.FC<GalleryPageProps> = ({ onRouteChange }) => {
  // 1. Initial State from URL Search Params
  const getInitialUrlState = () => {
    if (typeof window === 'undefined') {
      return { q: '', element: '', rarity: '', sort: 'newest' as GallerySort };
    }
    const params = new URLSearchParams(window.location.search);
    const rawQ = params.get('q') || '';
    const q = rawQ.trim().length >= 2 ? rawQ.trim() : '';
    const rawElem = params.get('element') || '';
    const element = VALID_GALLERY_ELEMENTS.find((e) => e.toLowerCase() === rawElem.toLowerCase()) || '';
    const rawRarity = params.get('rarity') || '';
    const rarity = VALID_GALLERY_RARITIES.find((r) => r.toLowerCase() === rawRarity.toLowerCase()) || '';
    const rawSort = (params.get('sort') || 'newest').toLowerCase();
    const sort: GallerySort = rawSort === 'oldest' ? 'oldest' : 'newest';

    return { q, element, rarity, sort };
  };

  const initial = getInitialUrlState();
  const [searchVal, setSearchVal] = useState(initial.q);
  const [activeQ, setActiveQ] = useState(initial.q);
  const [selectedElement, setSelectedElement] = useState(initial.element);
  const [selectedRarity, setSelectedRarity] = useState<RarityTier | ''>(initial.rarity as RarityTier | '');
  const [selectedSort, setSelectedSort] = useState<GallerySort>(initial.sort);

  // Data & Pagination State
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Race Condition & Abort Controller Guards
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Mobile Filter Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Synchronize Filter State into URL Query Params
  const syncUrlParams = useCallback((q: string, element: string, rarity: string, sort: GallerySort) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (element) params.set('element', element);
    if (rarity) params.set('rarity', rarity);
    if (sort !== 'newest') params.set('sort', sort);

    const qs = params.toString();
    const newUrl = qs ? `/gallery?${qs}` : '/gallery';
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.pushState({}, '', newUrl);
    }
  }, []);

  // Fetch Gallery Items with Race Condition & Cancellation Guard
  const fetchGallery = useCallback(
    async (
      q: string,
      element: string,
      rarity: string,
      sort: GallerySort,
      cursor: string | null = null,
      isAppend = false
    ) => {
      // Increment request sequence ID and abort in-flight fetch
      const thisRequestId = ++requestIdRef.current;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (element) params.set('element', element);
      if (rarity) params.set('rarity', rarity);
      if (sort) params.set('sort', sort);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '24');

      try {
        const res = await fetch(`/api/gallery?${params.toString()}`, {
          signal: controller.signal
        });

        // Ignore stale response if a newer request was dispatched
        if (thisRequestId !== requestIdRef.current) return;

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          const message = errBody?.error?.message || `Server error (${res.status})`;
          throw new Error(message);
        }

        const data: GalleryResponse = await res.json();
        if (thisRequestId !== requestIdRef.current) return;

        if (isAppend) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }

        setHasMore(data.page.has_more);
        setNextCursor(data.page.next_cursor);
        setError(null);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (thisRequestId === requestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load guardians.');
        }
      } finally {
        if (thisRequestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    []
  );

  // Search Debounce (300ms) with 1-character suppression
  useEffect(() => {
    const timer = setTimeout(() => {
      const clean = searchVal.trim();
      // Suppress 1-character search terms rejected by API
      if (clean.length === 1) return;

      if (clean !== activeQ) {
        setActiveQ(clean);
        syncUrlParams(clean, selectedElement, selectedRarity, selectedSort);
        fetchGallery(clean, selectedElement, selectedRarity, selectedSort, null, false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchVal, activeQ, selectedElement, selectedRarity, selectedSort, syncUrlParams, fetchGallery]);

  // Initial Fetch & Back/Forward popstate listener
  useEffect(() => {
    fetchGallery(activeQ, selectedElement, selectedRarity, selectedSort, null, false);

    const handlePopState = () => {
      const state = getInitialUrlState();
      setSearchVal(state.q);
      setActiveQ(state.q);
      setSelectedElement(state.element);
      setSelectedRarity(state.rarity as RarityTier | '');
      setSelectedSort(state.sort);
      fetchGallery(state.q, state.element, state.rarity, state.sort, null, false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Filter Change Handlers
  const handleElementChange = (elem: string) => {
    setSelectedElement(elem);
    syncUrlParams(activeQ, elem, selectedRarity, selectedSort);
    fetchGallery(activeQ, elem, selectedRarity, selectedSort, null, false);
  };

  const handleRarityChange = (rar: RarityTier | '') => {
    setSelectedRarity(rar);
    syncUrlParams(activeQ, selectedElement, rar, selectedSort);
    fetchGallery(activeQ, selectedElement, rar, selectedSort, null, false);
  };

  const handleSortChange = (s: GallerySort) => {
    setSelectedSort(s);
    syncUrlParams(activeQ, selectedElement, selectedRarity, s);
    fetchGallery(activeQ, selectedElement, selectedRarity, s, null, false);
  };

  const handleClearQuery = () => {
    setSearchVal('');
    setActiveQ('');
    syncUrlParams('', selectedElement, selectedRarity, selectedSort);
    fetchGallery('', selectedElement, selectedRarity, selectedSort, null, false);
  };

  const handleClearFilters = () => {
    setSearchVal('');
    setActiveQ('');
    setSelectedElement('');
    setSelectedRarity('');
    setSelectedSort('newest');
    syncUrlParams('', '', '', 'newest');
    fetchGallery('', '', '', 'newest', null, false);
  };

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchGallery(activeQ, selectedElement, selectedRarity, selectedSort, nextCursor, true);
    }
  };

  // Mobile Drawer Focus Trap & Escape Key Listener
  useEffect(() => {
    if (!drawerOpen) return;

    const drawerEl = drawerRef.current;
    if (drawerEl) {
      const focusables = drawerEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length > 0) {
        focusables[0]?.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        drawerTriggerRef.current?.focus();
        return;
      }

      if (e.key === 'Tab' && drawerEl) {
        const focusables = drawerEl.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  const activeFilterCount = (selectedElement ? 1 : 0) + (selectedRarity ? 1 : 0);

  return (
    <div
      className="gallery-page"
      style={{
        background: '#07090e',
        color: '#f0f6fc',
        minHeight: '100vh',
        fontFamily: "'Schibsted Grotesk', sans-serif",
        padding: '40px 20px 80px'
      }}
    >
      <style>{`
        @keyframes gallery-strip-play {
          from { background-position: 0 0; }
          to { background-position: -2700px 0; }
        }
        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 20px;
        }
        @media (min-width: 640px) {
          .gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (min-width: 1024px) {
          .gallery-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (min-width: 1440px) {
          .gallery-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        .filter-select {
          background: #0d111a;
          color: #f0f6fc;
          border: 1px solid rgba(0, 240, 255, 0.2);
          border-radius: 8px;
          padding: 8px 12px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .filter-select:focus {
          border-color: #00f0ff;
          box-shadow: 0 0 10px rgba(0, 240, 255, 0.25);
        }
        .mobile-filter-trigger {
          display: none !important;
        }
        .desktop-filter-selects {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        @media (max-width: 639px) {
          .mobile-filter-trigger {
            display: inline-flex !important;
          }
          .desktop-filter-selects {
            display: none !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Page Header */}
        <header style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0, 240, 255, 0.08)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              color: '#00f0ff',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '12px'
            }}
          >
            ✦ Realm Showcase ✦
          </div>

          <h1
            style={{
              fontFamily: "'Archivo', sans-serif",
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 900,
              color: '#ffffff',
              margin: '0 0 10px',
              letterSpacing: '-0.02em',
              textShadow: '0 0 24px rgba(0, 240, 255, 0.2)'
            }}
          >
            Gallery of Guardians
          </h1>

          <p
            style={{
              color: '#8b9bb4',
              fontSize: '15px',
              maxWidth: '560px',
              margin: '0 auto',
              lineHeight: 1.5
            }}
          >
            Discover living companion pets hatched by GitHub developers.{' '}
            <button
              type="button"
              onClick={() => onRouteChange('/explore')}
              style={{
                background: 'none',
                border: 'none',
                color: '#00f0ff',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline'
              }}
            >
              Explore egg archetypes →
            </button>
          </p>
        </header>

        {/* Toolbar & Search Bar */}
        <section
          aria-label="Gallery filters and search"
          style={{
            background: '#0d111a',
            border: '1px solid rgba(0, 240, 255, 0.2)',
            borderRadius: '14px',
            padding: '16px',
            marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            {/* Search Input Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#07090e',
                border: '1px solid rgba(0, 240, 255, 0.25)',
                borderRadius: '8px',
                padding: '6px 12px',
                flex: '1 1 260px',
                maxWidth: '400px'
              }}
            >
              <span style={{ color: '#00f0ff', fontSize: '14px' }}>🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by owner or guardian..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                aria-label="Search guardians by owner or name"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  width: '100%',
                  outline: 'none'
                }}
              />
              {searchVal && (
                <button
                  type="button"
                  onClick={handleClearQuery}
                  aria-label="Clear search text"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#8b9bb4',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '2px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Desktop Filters (Hidden on mobile viewports via CSS) */}
            <div
              className="desktop-filter-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              <div className="desktop-filter-selects">
                {/* Element Dropdown */}
                <label htmlFor="gallery-element-select" className="sr-only">Filter by Element</label>
                <select
                  id="gallery-element-select"
                  value={selectedElement}
                  onChange={(e) => handleElementChange(e.target.value)}
                  className="filter-select"
                  aria-label="Filter by element"
                >
                  <option value="">All Elements</option>
                  {VALID_GALLERY_ELEMENTS.map((elem) => (
                    <option key={elem} value={elem}>
                      {elem}
                    </option>
                  ))}
                </select>

                {/* Rarity Dropdown */}
                <label htmlFor="gallery-rarity-select" className="sr-only">Filter by Rarity</label>
                <select
                  id="gallery-rarity-select"
                  value={selectedRarity}
                  onChange={(e) => handleRarityChange(e.target.value as RarityTier | '')}
                  className="filter-select"
                  aria-label="Filter by rarity tier"
                >
                  <option value="">All Rarities</option>
                  {VALID_GALLERY_RARITIES.map((rar) => (
                    <option key={rar} value={rar}>
                      {rar}
                    </option>
                  ))}
                </select>

                {/* Sort Selector */}
                <label htmlFor="gallery-sort-select" className="sr-only">Sort by</label>
                <select
                  id="gallery-sort-select"
                  value={selectedSort}
                  onChange={(e) => handleSortChange(e.target.value as GallerySort)}
                  className="filter-select"
                  aria-label="Sort order"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>

              {/* Mobile Filter Drawer Button (Visible on mobile viewports via CSS) */}
              <button
                ref={drawerTriggerRef}
                type="button"
                className="mobile-filter-trigger"
                onClick={() => setDrawerOpen(true)}
                aria-expanded={drawerOpen}
                aria-controls="mobile-filter-drawer"
                style={{
                  alignItems: 'center',
                  gap: '6px',
                  background: activeFilterCount > 0 ? 'rgba(0, 240, 255, 0.2)' : '#0d111a',
                  border: `1px solid ${activeFilterCount > 0 ? '#00f0ff' : 'rgba(0, 240, 255, 0.3)'}`,
                  color: '#ffffff',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: '44px',
                  minWidth: '44px'
                }}
              >
                <span>⚙️ Filters</span>
                {activeFilterCount > 0 && (
                  <span
                    style={{
                      background: '#00f0ff',
                      color: '#000000',
                      borderRadius: '50%',
                      padding: '2px 6px',
                      fontSize: '10px',
                      fontWeight: 800
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active Filter Chips */}
          {(activeQ || selectedElement || selectedRarity || selectedSort !== 'newest') && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  color: '#8b9bb4',
                  fontWeight: 700
                }}
              >
                Active Filters:
              </span>

              {activeQ && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(0, 240, 255, 0.1)',
                    border: '1px solid #00f0ff',
                    color: '#00f0ff',
                    borderRadius: '9999px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace"
                  }}
                >
                  Query: "{activeQ}"
                  <button
                    type="button"
                    onClick={handleClearQuery}
                    style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </span>
              )}

              {selectedElement && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(0, 240, 255, 0.1)',
                    border: '1px solid #00f0ff',
                    color: '#00f0ff',
                    borderRadius: '9999px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace"
                  }}
                >
                  {selectedElement}
                  <button
                    type="button"
                    onClick={() => handleElementChange('')}
                    style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </span>
              )}

              {selectedRarity && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: (RARITY_COLORS[selectedRarity] || RARITY_COLORS.Common).bg,
                    border: `1px solid ${(RARITY_COLORS[selectedRarity] || RARITY_COLORS.Common).border}`,
                    color: (RARITY_COLORS[selectedRarity] || RARITY_COLORS.Common).text,
                    borderRadius: '9999px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace"
                  }}
                >
                  {selectedRarity}
                  <button
                    type="button"
                    onClick={() => handleRarityChange('')}
                    style={{ background: 'none', border: 'none', color: (RARITY_COLORS[selectedRarity] || RARITY_COLORS.Common).text, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ff2a85',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '2px 6px'
                }}
              >
                Clear all
              </button>
            </div>
          )}
        </section>

        {/* Live Status Region */}
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            color: '#8b9bb4'
          }}
        >
          <span>
            {loading
              ? '✦ Loading guardians from realm...'
              : `✦ Showing ${items.length} hatched guardian${items.length === 1 ? '' : 's'}`}
          </span>
          {hasMore && <span>Page ready (more available)</span>}
        </div>

        {/* Main Content: Grid / Skeletons / Empty / Error */}
        {loading && items.length === 0 ? (
          <div className="gallery-grid" aria-busy="true">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  background: '#0d111a',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  aspectRatio: '1 / 1.3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 1.5s infinite'
                }}
              >
                <span style={{ fontSize: '24px', opacity: 0.3 }}>🦉</span>
              </div>
            ))}
          </div>
        ) : error && items.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#0d111a',
              borderRadius: '16px',
              border: '1px solid rgba(255, 42, 133, 0.3)'
            }}
          >
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>⚠️</span>
            <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '20px', color: '#ff2a85', margin: '0 0 8px' }}>
              Failed to load realm guardians
            </h2>
            <p style={{ color: '#8b9bb4', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px' }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => fetchGallery(activeQ, selectedElement, selectedRarity, selectedSort, null, false)}
              style={{
                background: 'linear-gradient(135deg, #00f0ff, #0099ff)',
                color: '#000000',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '8px',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#0d111a',
              borderRadius: '16px',
              border: '1px solid rgba(0, 240, 255, 0.15)'
            }}
          >
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>🥚</span>
            <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '20px', color: '#ffffff', margin: '0 0 8px' }}>
              No Guardians found
            </h2>
            <p style={{ color: '#8b9bb4', fontSize: '14px', maxWidth: '440px', margin: '0 auto 20px' }}>
              {activeQ || selectedElement || selectedRarity
                ? 'No hatched guardians match your current filters. Try adjusting your search or clearing filters.'
                : 'No companions have hatched in the realm yet! Be the first developer to hatch your companion.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {(activeQ || selectedElement || selectedRarity) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  style={{
                    background: 'rgba(0, 240, 255, 0.1)',
                    border: '1px solid #00f0ff',
                    color: '#00f0ff',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Clear Filters
                </button>
              )}
              <button
                type="button"
                onClick={() => onRouteChange('/')}
                style={{
                  background: 'linear-gradient(135deg, #00f0ff, #0099ff)',
                  color: '#000000',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Hatch your Guardian ⚡
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="gallery-grid">
              {items.map((item) => (
                <GuardianGalleryCard key={item.id} item={item} onRouteChange={onRouteChange} />
              ))}
            </div>

            {/* Keyset Pagination Load More Button */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '40px' }}>
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    background: 'rgba(0, 240, 255, 0.1)',
                    border: '1px solid #00f0ff',
                    color: '#00f0ff',
                    padding: '12px 32px',
                    borderRadius: '10px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '13px',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                    boxShadow: '0 0 20px rgba(0, 240, 255, 0.25)',
                    transition: 'all 0.2s ease',
                    minHeight: '44px'
                  }}
                >
                  {loadingMore ? '✦ Loading next guardians...' : '✦ Load More Guardians ✦'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Filter Drawer Overlay & Modal */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter Guardians"
          id="mobile-filter-drawer"
          ref={drawerRef}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 9, 14, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDrawerOpen(false);
              drawerTriggerRef.current?.focus();
            }
          }}
        >
          <div
            style={{
              background: '#0d111a',
              borderLeft: '1px solid rgba(0, 240, 255, 0.3)',
              width: '100%',
              maxWidth: '340px',
              height: '100%',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '18px', color: '#ffffff', margin: 0 }}>
                Filter Guardians
              </h2>
              <button
                type="button"
                onClick={() => { setDrawerOpen(false); drawerTriggerRef.current?.focus(); }}
                aria-label="Close filters drawer"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8b9bb4',
                  fontSize: '20px',
                  cursor: 'pointer',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Mobile Element Selector */}
            <div>
              <label
                htmlFor="mobile-element-select"
                style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#00f0ff', marginBottom: '8px', fontWeight: 700 }}
              >
                Element:
              </label>
              <select
                id="mobile-element-select"
                value={selectedElement}
                onChange={(e) => handleElementChange(e.target.value)}
                className="filter-select"
                style={{ width: '100%', minHeight: '44px' }}
              >
                <option value="">All Elements</option>
                {VALID_GALLERY_ELEMENTS.map((elem) => (
                  <option key={elem} value={elem}>{elem}</option>
                ))}
              </select>
            </div>

            {/* Mobile Rarity Selector */}
            <div>
              <label
                htmlFor="mobile-rarity-select"
                style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#00f0ff', marginBottom: '8px', fontWeight: 700 }}
              >
                Rarity Tier:
              </label>
              <select
                id="mobile-rarity-select"
                value={selectedRarity}
                onChange={(e) => handleRarityChange(e.target.value as RarityTier | '')}
                className="filter-select"
                style={{ width: '100%', minHeight: '44px' }}
              >
                <option value="">All Rarities</option>
                {VALID_GALLERY_RARITIES.map((rar) => (
                  <option key={rar} value={rar}>{rar}</option>
                ))}
              </select>
            </div>

            {/* Mobile Sort Selector */}
            <div>
              <label
                htmlFor="mobile-sort-select"
                style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#00f0ff', marginBottom: '8px', fontWeight: 700 }}
              >
                Sort by:
              </label>
              <select
                id="mobile-sort-select"
                value={selectedSort}
                onChange={(e) => handleSortChange(e.target.value as GallerySort)}
                className="filter-select"
                style={{ width: '100%', minHeight: '44px' }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { handleClearFilters(); setDrawerOpen(false); }}
                style={{
                  flex: 1,
                  background: 'rgba(255, 42, 133, 0.1)',
                  border: '1px solid #ff2a85',
                  color: '#ff2a85',
                  padding: '12px',
                  borderRadius: '8px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => { setDrawerOpen(false); drawerTriggerRef.current?.focus(); }}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #00f0ff, #0099ff)',
                  border: 'none',
                  color: '#000000',
                  padding: '12px',
                  borderRadius: '8px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 800,
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
