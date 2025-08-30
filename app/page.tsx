// /app/page.tsx
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';

// --- Gallery Component ---
function Gallery() {
  const [images, setImages] = useState<MotionImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [message, setMessage] = useState(''); // State for on-screen messages

  const apiKey = process.env.NEXT_PUBLIC_API_KEY;

  const fetchImages = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/images', {
        headers: { 'x-api-key': apiKey || '' }
      });
      if (!res.ok) throw new Error('Failed to fetch images');
      const data = await res.json();
      setImages(data.images || []);
    } catch (error) {
      console.error("Error fetching images:", error);
      setImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleTriggerCapture = async () => {
    setIsTriggering(true);
    setMessage(''); // Clear previous messages
    try {
      const res = await fetch('/api/trigger-capture', { 
        method: 'POST',
        headers: { 'x-api-key': apiKey || '' }
      });
      if (!res.ok) throw new Error('Failed to trigger capture');
      setMessage('Capture request sent! Refresh in a few seconds.');
    } catch (error) {
      console.error("Error triggering capture:", error);
      setMessage('Failed to send capture request.');
    } finally {
      setIsTriggering(false);
      // Make the message disappear after 4 seconds
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const handleRefresh = () => {
    fetchImages();
  };

  const formatTimestamp = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <>
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400">ESP32-CAM Control Panel</h1>
        <p className="text-lg text-gray-400 mt-2">Live motion log and manual capture</p>
      </header>

      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={handleTriggerCapture}
          disabled={isTriggering}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {isTriggering ? 'Sending...' : 'Take Picture'}
        </button>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Loading...' : 'Refresh Gallery'}
        </button>
      </div>

      {/* On-screen message area */}
      <div className="text-center h-6 mb-4">
        {message && <p className="text-green-400">{message}</p>}
      </div>

      {isLoading ? (
         <div className="text-center py-20 text-xl text-gray-500">Loading Images...</div>
      ) : images.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((image) => (
            <div key={image.url} className="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
              <div className="relative w-full h-56">
                 <Image
                  src={image.url}
                  alt="Motion capture"
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                />
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-300 text-center">
                  {formatTimestamp(image.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-xl text-gray-500">No motion detected yet. Try a manual capture!</p>
        </div>
      )}
    </>
  );
}

// --- Main Page Component ---
export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    // Compare against the environment variable, not a hardcoded string
    if (password === process.env.NEXT_PUBLIC_PAGE_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  return (
    <main className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4">
      <div className="container mx-auto max-w-4xl">
        {isAuthenticated ? (
          <Gallery />
        ) : (
          <div className="w-full max-w-sm mx-auto">
            <form onSubmit={handleLogin} className="bg-gray-800 shadow-md rounded-lg px-8 pt-6 pb-8 mb-4">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-center text-cyan-400 mb-4">Access Control Panel</h1>
                <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="******************"
                  className="shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 text-white leading-tight focus:outline-none focus:shadow-outline focus:border-cyan-500"
                />
              </div>
              {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full"
                >
                  Sign In
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

// Define the interface for our image data
interface MotionImage {
  url: string;
  timestamp: string;
}
