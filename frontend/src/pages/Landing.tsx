import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

/** Ports index.html. */
export function Landing() {
  return (
    <>
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="flex items-center gap-2">
            <div className="brand-mark"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 21s-6.716-4.29-9.428-8.114C.688 10.09 1.5 6 5 5c2.2-.14 3.6 1.02 4.5 2.3.2.29.6.29.8 0C11.2 6.02 12.6 4.86 14.8 5c3.5 1 4.312 5.09 2.428 7.886C18.716 16.71 12 21 12 21z" /></svg></div>
            <span className="brand-name">SynCura</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth/login" className="text-sm font-medium text-gray-600 hover:text-purple-700" style={{ padding: '.5rem .75rem' }}>Sign In</Link>
            <Link to="/auth/role-select" className="text-sm font-semibold text-white rounded-xl" style={{ background: '#5B3F8D', padding: '.625rem 1.25rem' }}>Get Started</Link>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-pill"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Bangladesh's First Unified Healthcare Platform</div>
          <h1>One Platform for All<br />Your Healthcare Needs</h1>
          <p>Book appointments, manage medical records, consult doctors online, order medicine, and get lab tests — all in one place, built for Bangladesh.</p>
          <div className="hero-actions">
            <Link to="/auth/role-select" className="hero-btn-white">Get Started Free <Icon name="arrow-right" className="icon icon-18" /></Link>
            <Link to="/auth/login" className="hero-btn-outline">Sign In</Link>
          </div>
          <div className="hero-trust">
            <div className="flex items-center gap-2"><Icon name="check-circle" className="icon icon-16 text-green-400" /> Free for patients</div>
            <div className="flex items-center gap-2"><Icon name="check-circle" className="icon icon-16 text-green-400" /> Secure &amp; private</div>
            <div className="flex items-center gap-2"><Icon name="check-circle" className="icon icon-16 text-green-400" /> bKash &middot; Nagad &middot; Rocket</div>
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="section-inner">
          <div className="section-head">
            <h2>Everything You Need in One Place</h2>
            <p>SynCura connects every part of your healthcare journey — seamlessly.</p>
          </div>
          <div className="feature-grid">
            {[
              { icon: 'calendar', bg: '#5B3F8D18', fg: '#5B3F8D', title: 'Book Appointments', desc: 'Find and book doctors at top hospitals across Bangladesh in minutes. No waiting on hold.' },
              { icon: 'file-text', bg: '#8E5DAF18', fg: '#8E5DAF', title: 'Unified Medical Records', desc: 'All your health history, prescriptions, and reports in one secure timeline.' },
              { icon: 'video', bg: '#B57BC418', fg: '#B57BC4', title: 'Telemedicine', desc: 'Video and chat consultations with verified doctors from the comfort of home.' },
              { icon: 'shopping-bag', bg: '#5B3F8D18', fg: '#5B3F8D', title: 'Online Pharmacy', desc: 'Order medicines with home delivery. Pay with bKash, Nagad, or Rocket.' },
              { icon: 'flask-conical', bg: '#8E5DAF18', fg: '#8E5DAF', title: 'Lab Tests', desc: 'Book diagnostic tests at certified labs. Get results delivered to your portal.' },
              { icon: 'shield', bg: '#B57BC418', fg: '#B57BC4', title: 'Secure & Compliant', desc: 'Your health data is encrypted and protected. Only you and your doctors can access it.' },
            ].map((f) => (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon" style={{ background: f.bg, color: f.fg }}><Icon name={f.icon} className="icon icon-22" /></div>
                <h3>{f.title}</h3><p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="section-inner mid">
          <div className="section-head">
            <h2>How SynCura Works</h2>
            <p>Get started in 3 simple steps.</p>
          </div>
          <div className="steps-grid">
            <div className="step-item"><div className="step-num">01</div><h3>Create Your Account</h3><p>Sign up for free as a patient. Verify your number and set up your health profile.</p></div>
            <div className="step-item"><div className="step-num">02</div><h3>Find &amp; Book</h3><p>Search for doctors by specialty, read reviews, and book an appointment at your preferred hospital.</p></div>
            <div className="step-item"><div className="step-num">03</div><h3>Get Care</h3><p>Attend in-person or online, get your prescription digitally, and order medicines from our pharmacy.</p></div>
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="section-inner">
          <div className="section-head" style={{ marginBottom: '3rem' }}><h2>Trusted by Thousands</h2></div>
          <div className="testi-grid">
            {[
              { initial: 'F', quote: 'I booked an appointment and got my lab results — all without leaving my house. Incredible service!', name: 'Fatima Begum', role: 'Patient, Dhaka' },
              { initial: 'D', quote: 'Managing my patients and schedules is so much easier. The patient record system is excellent.', name: 'Dr. Karim Hossain', role: 'Cardiologist, BIRDEM' },
              { initial: 'R', quote: 'Paid with bKash in seconds. The whole experience felt safe and professional.', name: 'Rashida Ahmed', role: 'Patient, Chittagong' },
            ].map((t) => (
              <div className="testi-card" key={t.name}>
                <div className="testi-stars">★★★★★</div>
                <p className="quote">"{t.quote}"</p>
                <div className="testi-person"><div className="testi-avatar">{t.initial}</div><div><div className="n">{t.name}</div><div className="r">{t.role}</div></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-inner">
          <h2>Start Your Health Journey Today</h2>
          <p>Join thousands of patients, doctors, and healthcare providers on SynCura.</p>
          <Link to="/auth/role-select" className="hero-btn-white">Create Free Account</Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="brand-mark" style={{ width: '1.75rem', height: '1.75rem' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 21s-6.716-4.29-9.428-8.114C.688 10.09 1.5 6 5 5c2.2-.14 3.6 1.02 4.5 2.3.2.29.6.29.8 0C11.2 6.02 12.6 4.86 14.8 5c3.5 1 4.312 5.09 2.428 7.886C18.716 16.71 12 21 12 21z" /></svg></div>
              <span className="font-bold text-white font-heading">SynCura</span>
            </div>
            <p>Bangladesh's unified healthcare management platform.</p>
          </div>
          <div className="footer-cols">
            <div className="col"><span className="title">Platform</span><span>For Patients</span><span>For Doctors</span><span>For Hospitals</span><span>For Labs</span></div>
            <div className="col">
              <span className="title">Contact</span>
              <span className="flex items-center gap-2"><Icon name="phone" className="icon icon-12" /> +880 1XXX-XXXXXX</span>
              <span className="flex items-center gap-2"><Icon name="mail" className="icon icon-12" /> support@syncura.com.bd</span>
            </div>
          </div>
        </div>
        <div className="footer-bottom">© 2026 SynCura Health Technologies Ltd. · Dhaka, Bangladesh · All rights reserved.</div>
      </footer>
    </>
  );
}
