import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  Search,
  X,
  Calendar,
  MapPin,
  Loader2,
  AlertCircle,
  RefreshCw,
  SearchX,
  Building2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import ItemCard from '../components/explore/ItemCard.jsx'
import ItemCardSkeleton from '../components/explore/ItemCardSkeleton.jsx'
import { fetchExploreItems } from '../api/explore.js'
import { LOST_ITEM_CATEGORIES, CAMPUS_LOCATIONS } from '../data/lostItemOptions.js'
import './ExplorePage.css'

export default function ExplorePage() {
  const { user, token, loading, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Read initial filters from URL query params
  const initialSearch = searchParams.get('search') || ''
  const initialType = searchParams.get('type') || 'all'
  const initialCategory = searchParams.get('category') || 'all'
  const initialLocation = searchParams.get('location') || 'all'
  const initialDatePreset = searchParams.get('date_preset') || 'all'
  const initialSort = searchParams.get('sort') || 'newest'

  // Filter States
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [activeSearch, setActiveSearch] = useState(initialSearch)
  const [activeType, setActiveType] = useState(initialType)
  const [activeCategory, setActiveCategory] = useState(initialCategory)
  const [activeLocation, setActiveLocation] = useState(initialLocation)
  const [activeDatePreset, setActiveDatePreset] = useState(initialDatePreset)
  const [activeSort, setActiveSort] = useState(initialSort)

  // Data & Pagination States
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState('')

  // Route protection
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login')
    }
  }, [loading, isAuthenticated, navigate])

  // Debounce search input -> activeSearch
  const searchDebounceTimer = useRef(null)
  useEffect(() => {
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current)
    }
    searchDebounceTimer.current = setTimeout(() => {
      setActiveSearch(searchInput.trim())
    }, 320)

    return () => {
      if (searchDebounceTimer.current) {
        clearTimeout(searchDebounceTimer.current)
      }
    }
  }, [searchInput])

  // Sync state into URL query params
  useEffect(() => {
    const params = new URLSearchParams()
    if (activeSearch) params.set('search', activeSearch)
    if (activeType !== 'all') params.set('type', activeType)
    if (activeCategory !== 'all') params.set('category', activeCategory)
    if (activeLocation !== 'all') params.set('location', activeLocation)
    if (activeDatePreset !== 'all') params.set('date_preset', activeDatePreset)
    if (activeSort !== 'newest') params.set('sort', activeSort)

    setSearchParams(params, { replace: true })
  }, [activeSearch, activeType, activeCategory, activeLocation, activeDatePreset, activeSort, setSearchParams])

  // Fetch Items from Backend
  const loadExploreData = useCallback(
    async (targetPage = 1, append = false) => {
      if (!token) return

      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }
      setError('')

      try {
        const res = await fetchExploreItems(
          {
            search: activeSearch,
            type: activeType,
            category: activeCategory,
            location: activeLocation,
            date_preset: activeDatePreset,
            sort: activeSort,
            page: targetPage,
            limit: 12,
            campus: user?.campus,
          },
          token
        )

        if (append) {
          setItems((prev) => [...prev, ...res.items])
        } else {
          setItems(res.items)
        }
        setTotal(res.total)
        setPage(res.page)
        setPages(res.pages)
      } catch (err) {
        console.error('Explore fetch error:', err)
        setError(err.message || 'Unable to load campus reports.')
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [
      token,
      activeSearch,
      activeType,
      activeCategory,
      activeLocation,
      activeDatePreset,
      activeSort,
      user?.campus,
    ]
  )

  // Reload from page 1 whenever search, filters, or sort change
  useEffect(() => {
    if (isAuthenticated) {
      loadExploreData(1, false)
    }
  }, [isAuthenticated, loadExploreData])

  function handleLoadMore() {
    if (page < pages && !isLoadingMore) {
      loadExploreData(page + 1, true)
    }
  }

  function handleClearFilters() {
    setSearchInput('')
    setActiveSearch('')
    setActiveType('all')
    setActiveCategory('all')
    setActiveLocation('all')
    setActiveDatePreset('all')
    setActiveSort('newest')
  }

  const isFiltersDirty =
    Boolean(searchInput) ||
    activeType !== 'all' ||
    activeCategory !== 'all' ||
    activeLocation !== 'all' ||
    activeDatePreset !== 'all' ||
    activeSort !== 'newest'

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__spinner" />
        <p>Loading Tracelt Explore&hellip;</p>
      </div>
    )
  }

  if (!user) return null

  const campusName = user?.campus?.trim() ? user.campus : 'All Campuses'

  return (
    <div className="dashboard-app">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab="explore"
        setActiveTab={(tab) => {
          navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)
        }}
        user={user}
        logout={logout}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Area */}
      <div className="dashboard-main-area">
        <DashboardHeader
          activeTabTitle="Campus Directory"
          user={user}
          logout={logout}
          onOpenNotifications={() => navigate('/dashboard')}
          onOpenReportModal={(type) => {
            if (type === 'lost') navigate('/report-lost')
            else navigate('/report-found')
          }}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        />

        <main className="dashboard-content">
          <div className="explore-page">
            {/* Header Title & Campus Scoping Banner */}
            <header className="explore-header">
              <div className="explore-header__info">
                <span className="explore-campus-pill">
                  <MapPin size={12} /> {campusName}
                </span>
                <h1 className="explore-header__title">Explore Campus Items</h1>
                <p className="explore-header__subtitle">
                  Discover lost and found items reported around your campus.
                </p>
              </div>

              <div className="explore-header__actions">
                <Link to="/report-lost" className="btn-secondary" style={{ padding: '9px 16px' }}>
                  + Report Lost
                </Link>
                <Link to="/report-found" className="btn-primary" style={{ padding: '9px 18px' }}>
                  + Report Found
                </Link>
              </div>
            </header>

            {/* Search & Filter Toolbar Card */}
            <section className="explore-controls-card">
              {/* Row 1: Search Box & Type Tabs */}
              <div className="explore-search-row">
                <div className="explore-search-box">
                  <Search size={17} className="explore-search-icon" />
                  <input
                    type="text"
                    className="explore-search-input"
                    placeholder="Search items by title, description, category, or location..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    aria-label="Search items"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      className="explore-search-clear"
                      onClick={() => setSearchInput('')}
                      aria-label="Clear search text"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Lost / Found / All Segmented Switcher */}
                <div className="explore-type-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeType === 'all'}
                    className={`explore-tab-btn ${activeType === 'all' ? 'explore-tab-btn--active' : ''}`}
                    onClick={() => setActiveType('all')}
                  >
                    All Items
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeType === 'lost'}
                    className={`explore-tab-btn ${activeType === 'lost' ? 'explore-tab-btn--active' : ''}`}
                    onClick={() => setActiveType('lost')}
                  >
                    Lost Items
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeType === 'found'}
                    className={`explore-tab-btn ${activeType === 'found' ? 'explore-tab-btn--active' : ''}`}
                    onClick={() => setActiveType('found')}
                  >
                    Found Items
                  </button>
                </div>
              </div>

              {/* Row 2: Secondary Dropdowns (Category, Location, Date, Sort, Clear) */}
              <div className="explore-filter-bar">
                <div className="explore-filters-group">
                  {/* Category Dropdown */}
                  <select
                    className="explore-select"
                    value={activeCategory}
                    onChange={(e) => setActiveCategory(e.target.value)}
                    aria-label="Filter by category"
                  >
                    <option value="all">All Categories</option>
                    {LOST_ITEM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  {/* Location Dropdown */}
                  <select
                    className="explore-select"
                    value={activeLocation}
                    onChange={(e) => setActiveLocation(e.target.value)}
                    aria-label="Filter by campus location"
                  >
                    <option value="all">All Locations</option>
                    {CAMPUS_LOCATIONS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>

                  {/* Date Preset Dropdown */}
                  <select
                    className="explore-select"
                    value={activeDatePreset}
                    onChange={(e) => setActiveDatePreset(e.target.value)}
                    aria-label="Filter by date range"
                  >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                  </select>

                  {/* Sort Order Dropdown */}
                  <select
                    className="explore-select"
                    value={activeSort}
                    onChange={(e) => setActiveSort(e.target.value)}
                    aria-label="Sort reports"
                  >
                    <option value="newest">Sort: Newest First</option>
                    <option value="oldest">Sort: Oldest First</option>
                    <option value="date_newest">Sort: Date (Newest)</option>
                    <option value="date_oldest">Sort: Date (Oldest)</option>
                  </select>
                </div>

                {isFiltersDirty && (
                  <button
                    type="button"
                    className="btn-clear-filters"
                    onClick={handleClearFilters}
                  >
                    <X size={14} /> Clear Filters
                  </button>
                )}
              </div>
            </section>

            {/* Error Banner */}
            {error && (
              <div className="report-server-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => loadExploreData(1, false)}
                  style={{
                    marginLeft: 'auto',
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Results Count Meta */}
            <div className="explore-results-meta">
              <span>
                <span className="explore-count-highlight">{total}</span> {total === 1 ? 'item' : 'items'} found in{' '}
                <strong>{campusName}</strong>
              </span>
              {isLoading && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <Loader2 size={13} className="animate-spin" /> Updating...
                </span>
              )}
            </div>

            {/* Items Grid */}
            {isLoading && items.length === 0 ? (
              <div className="explore-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ItemCardSkeleton key={i} />
                ))}
              </div>
            ) : items.length === 0 ? (
              /* Empty State */
              <div className="explore-empty-state">
                <div className="explore-empty-icon-box">
                  {isFiltersDirty ? (
                    <SearchX size={36} strokeWidth={1.6} />
                  ) : (
                    <Building2 size={36} strokeWidth={1.6} />
                  )}
                </div>
                <h2 className="explore-empty-title">
                  {isFiltersDirty ? 'No items match your criteria' : `No reports yet on ${campusName}`}
                </h2>
                <p className="explore-empty-desc">
                  {isFiltersDirty
                    ? 'Try adjusting your search terms, categories, or location filters to broaden your discovery.'
                    : 'Be the first to report a lost or found item to help fellow students and staff on your campus.'}
                </p>

                {isFiltersDirty ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleClearFilters}
                  >
                    Clear All Filters
                  </button>
                ) : (
                  <div className="explore-empty-actions">
                    <Link to="/report-lost" className="btn-secondary">
                      Report Lost Item
                    </Link>
                    <Link to="/report-found" className="btn-primary">
                      Report Found Item
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="explore-grid">
                  {items.map((item) => (
                    <ItemCard
                      key={`${item.type}-${item.id}`}
                      item={item}
                      currentUserId={user?.id}
                    />
                  ))}
                </div>

                {/* Load More Pagination */}
                <div className="explore-load-more-row">
                  {page < pages ? (
                    <button
                      type="button"
                      className="explore-load-more-btn"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Loading more items...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} /> Load More Items
                        </>
                      )}
                    </button>
                  ) : total > 12 ? (
                    <span className="explore-end-message">
                      ✓ You have reached the end of the campus catalog.
                    </span>
                  ) : null}

                  <span className="explore-load-more-counter">
                    Showing {items.length} of {total} items
                  </span>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
