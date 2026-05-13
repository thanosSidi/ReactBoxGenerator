import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';

function STLViewer({ url }) {
  const [geometry, setGeometry] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (url) {
      setLoading(true);
      const loader = new STLLoader();
      loader.load(
        url,
        (geom) => {
          setGeometry(geom);
          setLoading(false);
        },
        (progress) => {
          console.log((progress.loaded / progress.total * 100) + '% loaded');
        },
        (error) => {
          console.error('An error happened', error);
          setLoading(false);
        }
      );
    }
  }, [url]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}

function App() {
  const [stlUrl, setStlUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchSTL = async () => {
    setLoading(true);
    // Placeholder: replace with actual FastAPI endpoint
    // For example, if the backend generates and returns a download URL
    // Assume the endpoint is http://localhost:8000/download/some-request-id
    // But since we don't have the request_id, perhaps the user needs to provide it.

    // For now, use a placeholder STL URL
    setStlUrl('https://example.com/model.stl'); // Replace with actual URL
    setLoading(false);
  };

  return (
    <div style={{ height: '100vh' }}>
      <button onClick={fetchSTL} disabled={loading}>Load STL</button>
      {loading && <p>Loading...</p>}
      <Canvas>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <STLViewer url={stlUrl} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}

export default App;