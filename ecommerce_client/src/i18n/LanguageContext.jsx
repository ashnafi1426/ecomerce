import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import translations from './translations'

const LanguageContext = createContext(null)

// ── helpers ──────────────────────────────────────────────────────

/** Read current googtrans cookie → language code, e.g. "/en/am" → "am" */
function readGTCookie() {
  const match = document.cookie.match(/googtrans=\/en\/([^;]+)/)
  return match ? match[1] : 'en'
}

/** Write or clear the googtrans cookie so Google Translate applies on load */
function writeGTCookie(langCode) {
  const hostname = window.location.hostname
  if (!langCode || langCode === 'en') {
    const past = 'Thu, 01 Jan 1970 00:00:00 UTC'
    document.cookie = `googtrans=; expires=${past}; path=/`
    document.cookie = `googtrans=; expires=${past}; path=/; domain=${hostname}`
    document.cookie = `googtrans=; expires=${past}; path=/; domain=.${hostname}`
  } else {
    document.cookie = `googtrans=/en/${langCode}; path=/`
    document.cookie = `googtrans=/en/${langCode}; path=/; domain=${hostname}`
  }
}

/**
 * Trigger Google Translate via the hidden <select> widget.
 * Returns true when the widget was found and triggered.
 */
function triggerGTSelect(langCode) {
  const select = document.querySelector('.goog-te-combo')
  if (!select) return false
  select.value = langCode === 'en' ? '' : langCode
  select.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

// ── provider ─────────────────────────────────────────────────────

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      const fromCookie = readGTCookie()
      if (fromCookie && fromCookie !== 'en') return fromCookie
      return localStorage.getItem('fs_lang') || 'en'
    } catch {
      return 'en'
    }
  })

  // Google Translate loads async – poll until the widget appears, then apply
  useEffect(() => {
    if (lang === 'en') return
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      if (triggerGTSelect(lang) || attempts > 40) clearInterval(interval)
    }, 300)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchLang = useCallback((code) => {
    setLang(code)
    try { localStorage.setItem('fs_lang', code) } catch { /* ignore */ }
    try { localStorage.setItem('fs_gt_lang', code) } catch { /* ignore */ }
    writeGTCookie(code)
    const triggered = triggerGTSelect(code)
    if (!triggered) window.location.reload()
  }, [])

  // t('key') → translated string; supports {placeholder} interpolation
  const t = useCallback(
    (key, vars = {}) => {
      const dict = translations[lang] || translations.en
      let str = dict[key] ?? translations.en[key] ?? key
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      })
      return str
    },
    [lang]
  )

  const currentLang = translations[lang] || translations.en
  const availableLangs = Object.keys(translations).map(code => ({
    code,
    name: translations[code].langName,
    flag: translations[code].langFlag,
    label: translations[code].langCode,
  }))

  return (
    <LanguageContext.Provider value={{ lang, t, switchLang, currentLang, availableLangs }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return ctx
}
