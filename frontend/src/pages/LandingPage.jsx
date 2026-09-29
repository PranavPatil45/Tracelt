import Navbar from '../components/Navbar.jsx'
import Hero from '../components/Hero.jsx'
import Stats from '../components/Stats.jsx'
import HowItWorks from '../components/HowItWorks.jsx'
import Features from '../components/Features.jsx'
import ProductPreview from '../components/ProductPreview.jsx'
import EmotionalCTA from '../components/EmotionalCTA.jsx'
import Community from '../components/Community.jsx'
import FAQ from '../components/FAQ.jsx'
import FinalCTA from '../components/FinalCTA.jsx'
import Footer from '../components/Footer.jsx'

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <HowItWorks />
        <Features />
        <ProductPreview />
        <EmotionalCTA />
        <Community />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
