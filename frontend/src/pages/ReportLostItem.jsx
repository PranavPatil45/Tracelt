import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import ImageUploader from '../components/lost/ImageUploader.jsx'
import { LOST_ITEM_CATEGORIES, CAMPUS_LOCATIONS } from '../data/lostItemOptions.js'
import { reportLostItem, uploadItemImage, LostItemApiError } from '../api/lostItems.js'
import './ReportLostItem.css'

export default function ReportLostItem() {
  const { user, token, loading, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Layout state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Form Fields State
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [customLocation, setCustomLocation] = useState('')
  const [lostDate, setLostDate] = useState(() => {
    // Default to today's date in YYYY-MM-DD
    const now = new Date()
    return now.toISOString().split('T')[0]
  })
  const [lostTime, setLostTime] = useState('')

  // Image state
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageError, setImageError] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState(null)

  const handleSetImageFile = (file) => {
    setImageFile(file)
    setUploadedUrl(null)
  }

  // Validation and Submission State
  const [fieldErrors, setFieldErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [createdItem, setCreatedItem] = useState(null)

  // Max allowed date is today
  const todayStr = new Date().toISOString().split('T')[0]

  // Route protection
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login')
    }
  }, [loading, isAuthenticated, navigate])

  function handleBlur(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
    validateField(field)
  }

  function validateField(field) {
    const nextErrors = { ...fieldErrors }

    if (field === 'title') {
      if (!title.trim()) {
        nextErrors.title = 'Please enter what you lost (e.g. Black Leather Wallet).'
      } else if (title.trim().length < 2) {
        nextErrors.title = 'Title must be at least 2 characters long.'
      } else {
        delete nextErrors.title
      }
    }

    if (field === 'category') {
      if (!category) {
        nextErrors.category = 'Please select a category for the item.'
      } else {
        delete nextErrors.category
      }
    }

    if (field === 'description') {
      if (!description.trim()) {
        nextErrors.description = 'Please describe the item (color, brand, distinguishing features).'
      } else if (description.trim().length < 5) {
        nextErrors.description = 'Description must be at least 5 characters long.'
      } else {
        delete nextErrors.description
      }
    }

    if (field === 'location') {
      if (!location) {
        nextErrors.location = 'Please select where you last saw the item.'
      } else if (location === 'Other' && !customLocation.trim()) {
        nextErrors.location = 'Please specify the campus location details.'
      } else {
        delete nextErrors.location
      }
    }

    if (field === 'lostDate') {
      if (!lostDate) {
        nextErrors.lostDate = 'Please select the date the item was lost.'
      } else if (lostDate > todayStr) {
        nextErrors.lostDate = 'Date lost cannot be in the future.'
      } else {
        delete nextErrors.lostDate
      }
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function validateAll() {
    const errors = {}

    if (!title.trim()) {
      errors.title = 'Please enter what you lost.'
    } else if (title.trim().length < 2) {
      errors.title = 'Title must be at least 2 characters.'
    }

    if (!category) {
      errors.category = 'Please select a category.'
    }

    if (!description.trim()) {
      errors.description = 'Please describe the item.'
    } else if (description.trim().length < 5) {
      errors.description = 'Description must be at least 5 characters.'
    }

    if (!location) {
      errors.location = 'Please select a campus location.'
    } else if (location === 'Other' && !customLocation.trim()) {
      errors.location = 'Please specify the campus location.'
    }

    if (!lostDate) {
      errors.lostDate = 'Please select the date lost.'
    } else if (lostDate > todayStr) {
      errors.lostDate = 'Date lost cannot be in the future.'
    }

    setFieldErrors(errors)
    setTouched({
      title: true,
      category: true,
      description: true,
      location: true,
      lostDate: true,
    })

    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')

    if (!validateAll()) {
      return
    }

    if (imageError) {
      return
    }

    setSubmitting(true)

    try {
      let finalImageUrl = uploadedUrl

      // Step 1: Upload image to server if selected and not already uploaded
      if (imageFile && !finalImageUrl) {
        const uploadResult = await uploadItemImage(imageFile, token)
        finalImageUrl = uploadResult.image_url
        setUploadedUrl(finalImageUrl)
      }

      // Step 2: Submit report to FastAPI backend
      const finalLocation = location === 'Other' ? customLocation.trim() : location
      const reportPayload = {
        title: title.trim(),
        category,
        description: description.trim(),
        location: finalLocation,
        lost_date: lostDate,
        lost_time: lostTime.trim() || null,
        image_url: finalImageUrl,
      }

      const created = await reportLostItem(reportPayload, token)
      setCreatedItem(created)
    } catch (err) {
      console.error('Report lost item error:', err)
      const message =
        err instanceof LostItemApiError
          ? err.message
          : 'Unable to submit your report. Please check your connection and try again.'
      setServerError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__spinner" />
        <p>Loading Tracelt&hellip;</p>
      </div>
    )
  }

  if (!user) return null

  const campusName = user?.campus?.trim() ? user.campus : 'your campus'

  return (
    <div className="dashboard-app">
      {/* Sidebar */}
      <Sidebar
        activeTab="lost-items"
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
          activeTabTitle="Report a Lost Item"
          user={user}
          logout={logout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        />

        <main className="dashboard-content report-page-content">
          <div className="report-page-container">
            {/* Back to Dashboard Navigation Link */}
            <div className="report-back-row">
              <Link to="/dashboard" className="report-back-link">
                <ArrowLeft size={16} />
                <span>Back to Dashboard</span>
              </Link>
            </div>

            {createdItem ? (
              /* Success State Screen */
              <div className="report-success-card" role="status" aria-live="polite">
                <div className="report-success-icon-wrap">
                  <CheckCircle2 size={44} strokeWidth={2.4} />
                </div>

                <div className="report-success-badge">
                  <CheckCircle2 size={13} />
                  <span>Report Published to Campus Registry</span>
                </div>

                <h1 className="report-success-title">Lost Item Reported</h1>
                <p className="report-success-desc">
                  Your report has been successfully added to Tracelt. Automated correlation is actively comparing
                  reports across <strong>{campusName}</strong>.
                </p>

                <div className="report-success-item-preview">
                  {createdItem.image_url && (
                    <div className="report-success-item-img">
                      <img src={createdItem.image_url} alt={createdItem.title} />
                    </div>
                  )}
                  <div className="report-success-item-details">
                    <span className="report-success-item-tag">{createdItem.category}</span>
                    <h3 className="report-success-item-name">&ldquo;{createdItem.title}&rdquo;</h3>
                    <p className="report-success-item-loc">
                      <MapPin size={13} /> Last seen at {createdItem.location} &bull; {createdItem.lost_date}
                    </p>
                  </div>
                </div>

                <div className="report-success-actions">
                  <Link to="/my-lost-items" className="btn btn-primary">
                    View My Lost Items <ArrowRight size={16} />
                  </Link>

                  <Link to="/dashboard" className="btn btn-secondary">
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              /* Report Lost Item Form Card */
              <div className="report-form-card">
                <div className="report-form-header">
                  <div className="report-badge">
                    <span className="live-dot" />
                    <span>Campus Recovery Network</span>
                  </div>
                  <h1 className="report-form-title">Report a Lost Item</h1>
                  <p className="report-form-subtitle">
                    Tell us what you lost and where you last saw it. We&rsquo;ll help you trace possible matches around your campus.
                  </p>
                </div>

                {serverError && (
                  <div className="report-server-error" role="alert">
                    <AlertCircle size={18} className="error-icon" />
                    <span>{serverError}</span>
                  </div>
                )}

                <form className="report-form" onSubmit={handleSubmit} noValidate>
                  {/* Field 1: Item Title */}
                  <div className="form-group">
                    <label htmlFor="item-title" className="form-label">
                      Item Title <span className="req">*</span>
                    </label>
                    <input
                      id="item-title"
                      type="text"
                      className={`form-input ${touched.title && fieldErrors.title ? 'form-input--error' : ''}`}
                      placeholder="e.g. Black Leather Wallet"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => handleBlur('title')}
                      disabled={submitting}
                      required
                    />
                    {touched.title && fieldErrors.title && (
                      <span className="field-error" role="alert">
                        {fieldErrors.title}
                      </span>
                    )}
                  </div>

                  {/* 2-Column Grid: Category & Location */}
                  <div className="form-grid-2">
                    {/* Field 2: Category */}
                    <div className="form-group">
                      <label htmlFor="item-category" className="form-label">
                        Category <span className="req">*</span>
                      </label>
                      <div className="select-wrap">
                        <select
                          id="item-category"
                          className={`form-select ${touched.category && fieldErrors.category ? 'form-input--error' : ''}`}
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          onBlur={() => handleBlur('category')}
                          disabled={submitting}
                          required
                        >
                          <option value="">Select category ▼</option>
                          {LOST_ITEM_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                      {touched.category && fieldErrors.category && (
                        <span className="field-error" role="alert">
                          {fieldErrors.category}
                        </span>
                      )}
                    </div>

                    {/* Field 4: Last Seen Location */}
                    <div className="form-group">
                      <label htmlFor="item-location" className="form-label">
                        Last Seen Location <span className="req">*</span>
                      </label>
                      <div className="select-wrap">
                        <select
                          id="item-location"
                          className={`form-select ${touched.location && fieldErrors.location ? 'form-input--error' : ''}`}
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          onBlur={() => handleBlur('location')}
                          disabled={submitting}
                          required
                        >
                          <option value="">Select campus location ▼</option>
                          {CAMPUS_LOCATIONS.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>
                      {touched.location && fieldErrors.location && (
                        <span className="field-error" role="alert">
                          {fieldErrors.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Custom location input if "Other" is selected */}
                  {location === 'Other' && (
                    <div className="form-group animate-fade">
                      <label htmlFor="custom-location" className="form-label">
                        Specific Location Details <span className="req">*</span>
                      </label>
                      <input
                        id="custom-location"
                        type="text"
                        className="form-input"
                        placeholder="e.g. Bench outside Chemistry Wing, 2nd Floor"
                        value={customLocation}
                        onChange={(e) => setCustomLocation(e.target.value)}
                        onBlur={() => handleBlur('location')}
                        disabled={submitting}
                        required
                      />
                    </div>
                  )}

                  {/* Field 3: Description */}
                  <div className="form-group">
                    <label htmlFor="item-desc" className="form-label">
                      Description <span className="req">*</span>
                    </label>
                    <textarea
                      id="item-desc"
                      rows={4}
                      className={`form-textarea ${touched.description && fieldErrors.description ? 'form-input--error' : ''}`}
                      placeholder="Describe the item in detail (color, brand markings, stickers, engravings, contents, lock code, etc.)..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => handleBlur('description')}
                      disabled={submitting}
                      required
                    />
                    {touched.description && fieldErrors.description && (
                      <span className="field-error" role="alert">
                        {fieldErrors.description}
                      </span>
                    )}
                  </div>

                  {/* 2-Column Grid: Date Lost & Approximate Time */}
                  <div className="form-grid-2">
                    {/* Field 5: Date Lost */}
                    <div className="form-group">
                      <label htmlFor="item-date" className="form-label">
                        Date Lost <span className="req">*</span>
                      </label>
                      <div className="input-with-icon">
                        <Calendar size={16} className="input-icon" />
                        <input
                          id="item-date"
                          type="date"
                          max={todayStr}
                          className={`form-input form-input--with-icon ${
                            touched.lostDate && fieldErrors.lostDate ? 'form-input--error' : ''
                          }`}
                          value={lostDate}
                          onChange={(e) => setLostDate(e.target.value)}
                          onBlur={() => handleBlur('lostDate')}
                          disabled={submitting}
                          required
                        />
                      </div>
                      {touched.lostDate && fieldErrors.lostDate && (
                        <span className="field-error" role="alert">
                          {fieldErrors.lostDate}
                        </span>
                      )}
                    </div>

                    {/* Field 6: Approximate Time (Optional) */}
                    <div className="form-group">
                      <label htmlFor="item-time" className="form-label">
                        Approximate Time <span className="image-uploader__optional">(Optional)</span>
                      </label>
                      <div className="input-with-icon">
                        <Clock size={16} className="input-icon" />
                        <input
                          id="item-time"
                          type="time"
                          className="form-input form-input--with-icon"
                          value={lostTime}
                          onChange={(e) => setLostTime(e.target.value)}
                          disabled={submitting}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Field 7: Item Image Upload (Optional) */}
                  <ImageUploader
                    imageFile={imageFile}
                    setImageFile={handleSetImageFile}
                    imagePreview={imagePreview}
                    setImagePreview={setImagePreview}
                    error={imageError}
                    setError={setImageError}
                    disabled={submitting}
                  />

                  {/* Form Footer Buttons */}
                  <div className="report-form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => navigate('/dashboard')}
                      disabled={submitting}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="btn btn-primary report-submit-btn"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={16} className="spin" />
                          <span>Reporting&hellip;</span>
                        </>
                      ) : (
                        <>
                          <span>Report Lost Item</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
