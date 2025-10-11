import React from 'react';

// Eagerly load the map component to ensure it renders reliably.
import MapWrapper from '../components/map/MapWrapper';

const Home: React.FC = () => {
  return (
    <div className="h-full w-full">
      <MapWrapper />
    </div>
  );
};

export default Home;