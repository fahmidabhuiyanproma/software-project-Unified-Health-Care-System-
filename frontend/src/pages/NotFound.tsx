import { Link } from 'react-router-dom';

/** Ports pages/404.html. */
export function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4" style={{ background: '#FAF7FB' }}>
      <div style={{ width: '4rem', height: '4rem', borderRadius: '1rem', background: '#5B3F8D', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="M12 21s-6.716-4.29-9.428-8.114C.688 10.09 1.5 6 5 5c2.2-.14 3.6 1.02 4.5 2.3.2.29.6.29.8 0C11.2 6.02 12.6 4.86 14.8 5c3.5 1 4.312 5.09 2.428 7.886C18.716 16.71 12 21 12 21z" /></svg>
      </div>
      <h1 className="text-6xl font-bold mb-3 font-heading" style={{ color: '#5B3F8D' }}>404</h1>
      <h2 className="text-xl font-semibold text-gray-800 mb-2 font-heading">Page Not Found</h2>
      <p className="text-gray-500 mb-8 max-w-sm">Sorry, the page you're looking for doesn't exist on the SynCura platform.</p>
      <Link to="/" className="btn btn-brand btn-lg">Back to Home</Link>
    </div>
  );
}
