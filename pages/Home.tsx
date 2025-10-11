import React, { Suspense, lazy } from 'react';

// Lazy load the map component to improve initial page load time
const MapWrapper = lazy(() => import('../components/map/MapWrapper'));

const Home: React.FC = () => {
  return (
    <div className="absolute inset-0">
      <Suspense fallback={<div className="flex items-center justify-center h-full w-full bg-brand-secondary text-gray-400">Loading Map...</div>}>
        <MapWrapper />
      </Suspense>
    </div>
  );
};

export default Home;