import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event) => setMatches(event.matches);

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

function STLViewer({ url, controlsRef }) {
  const [geometry, setGeometry] = useState(null);
  const meshRef = useRef();

  useEffect(() => {
    if (url) {
      const loader = new STLLoader();
      loader.load(
        url,
        (geom) => {
          // 1. Strip flat data
          geom.deleteAttribute('normal'); 
          
          // 2. FIXED: Use the direct imported module variable instead of THREE.*
          geom = BufferGeometryUtils.mergeVertices(geom); 
          
          // 3. Compute clean vector slopes
          geom.computeVertexNormals(); 
          
          setGeometry(geom);
        },
        (progress) => {
          console.log((progress.loaded / progress.total * 100) + '% loaded');
        },
        (error) => {
          console.error('An error happened', error);
        }
      );
    }
  }, [url]);

  useEffect(() => {
    if (geometry && meshRef.current && controlsRef.current) {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const size = box.getSize(new THREE.Vector3()).length();
      const camera = controlsRef.current.camera;

      camera.near = Math.max(size / 10000, 0.1);
      camera.far = Math.max(size * 100, 10000);
      camera.updateProjectionMatrix();

      controlsRef.current.maxDistance = camera.far / 2;
      controlsRef.current.fitToBox(meshRef.current, true, {
        paddingTop: size * 0.08,
        paddingRight: size * 0.08,
        paddingBottom: size * 0.08,
        paddingLeft: size * 0.08,
      });
      controlsRef.current.rotatePolarTo(1.1, false); // Dynamic isometric angle to capture sloped facets
    }
  }, [geometry, controlsRef]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial 
        color="#dd7616" 
        roughness={0.4}
        metalness={0.0}
        flatShading={false}
        
        // 1. CLEARCOAT (Simulates a smooth outer lacquer/finish layer over the plastic)
        clearcoat={0.3}             // Subtle glossy reflection layer on top
        clearcoatRoughness={0.2}    // Keeps the top gloss layer relatively sharp
        
        // 2. SHEEN (Mimics micro-fibers/fuzz or the soft look of matte plastic edges)
        sheen={1.0}                 // Intensity of the edge glow
        sheenRoughness={0.5}        // Softness of the edge highlights
        sheenColor="#ff9d42"        // A slightly lighter tint of your base orange for realistic highlights
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function App() {
  const [stlUrl, setStlUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const controlsRef = useRef();
  const isMobile = useMediaQuery('(max-width: 760px)');
  const [formData, setFormData] = useState({
    total_width_mm: 80,
    total_length_mm: 80,
    cell_w: 40,
    cell_l: 40,
    printer_w: 250,
    printer_l: 250,
    base_height: 3.2,
    tile_gap_mm: 20,
    cut_corner_radius: 3.0
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: parseFloat(value) || 0 });
  };

  const generateSTL = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://16.16.53.53/generate-baseplate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (response.ok) {
        const downloadUrl = `http://16.16.53.53/download/${data.request_id}`;
        setStlUrl(downloadUrl);
      } else {
        alert('Error generating STL: ' + data.detail);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate STL');
    }
    setLoading(false);
  };

  const downloadSTL = async () => {
    if (!stlUrl) return;

    try {
      const response = await fetch(stlUrl);
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = objectUrl;
      link.download = 'gridfinity-baseplate.stl';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Error downloading STL:', error);
      alert('Failed to download STL');
    }
  };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      backgroundColor: '#f8fafc',
      color: '#1e293b',
    },
    sidebar: {
      width: isMobile ? 'auto' : '420px',
      maxHeight: isMobile ? 'none' : '100vh',
      boxSizing: 'border-box',
      padding: isMobile ? '20px 16px' : '32px',
      overflowY: isMobile ? 'visible' : 'auto',
      backgroundColor: '#ffffff',
      borderRight: isMobile ? 'none' : '1px solid #e2e8f0',
      borderBottom: isMobile ? '1px solid #e2e8f0' : 'none',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      display: 'flex',
      flexDirection: 'column',
    },
    title: {
      fontSize: isMobile ? '22px' : '24px',
      fontWeight: 700,
      margin: '0 0 8px 0',
      color: '#1e3a8a',
      letterSpacing: '0',
    },
    subtitle: {
      fontSize: '14px',
      color: '#64748b',
      margin: '0 0 24px 0',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: isMobile ? '12px' : '16px 12px',
    },
    formField: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    fullWidthField: {
      gridColumn: isMobile ? 'auto' : 'span 2',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    label: {
      fontSize: '13px',
      fontWeight: 500,
      color: '#475569',
    },
    input: {
      padding: '10px 14px',
      borderRadius: '8px',
      border: '1px solid #cbd5e1',
      fontSize: '16px',
      outline: 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      backgroundColor: '#f8fafc',
      boxSizing: 'border-box',
      width: '100%',
    },
    button: {
      marginTop: isMobile ? '18px' : '24px',
      padding: '12px 20px',
      backgroundColor: '#2563eb',
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      fontSize: '15px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background-color 0.2s, transform 0.1s',
      boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    },
    buttonDisabled: {
      backgroundColor: '#93c5fd',
      cursor: 'not-allowed',
    },
    secondaryButton: {
      marginTop: '12px',
      padding: '12px 20px',
      backgroundColor: '#ffffff',
      color: '#2563eb',
      border: '1px solid #bfdbfe',
      borderRadius: '8px',
      fontSize: '15px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background-color 0.2s, border-color 0.2s',
    },
    canvasContainer: {
      flex: 1,
      minHeight: isMobile ? '45vh' : '100vh',
      height: isMobile ? '45vh' : '100vh',
      backgroundColor: '#f1f5f9',
      position: 'relative',
    },
    loaderOverlay: {
      position: 'absolute',
      top: isMobile ? '12px' : '20px',
      left: isMobile ? '12px' : '20px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      padding: '8px 16px',
      borderRadius: '20px',
      fontSize: '14px',
      fontWeight: 500,
      color: '#2563eb',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
      zIndex: 10,
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        input:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
          background-color: #ffffff !important;
        }
        button:hover:not(:disabled) {
          background-color: #1d4ed8 !important;
        }
        button:active:not(:disabled) {
          transform: translateY(1px);
        }
      `}</style>

      <div style={styles.sidebar}>
        <h1 style={styles.title}>Gridfinity Generator</h1>
        <p style={styles.subtitle}>Customize parameters to build your configuration baseplate.</p>
        
        <form onSubmit={(e) => { e.preventDefault(); generateSTL(); }} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={styles.grid}>
            <div style={styles.formField}>
              <label style={styles.label}>Total Width (mm)</label>
              <input type="number" name="total_width_mm" value={formData.total_width_mm} onChange={handleInputChange} step="0.1" style={styles.input} />
            </div>
            <div style={styles.formField}>
              <label style={styles.label}>Total Length (mm)</label>
              <input type="number" name="total_length_mm" value={formData.total_length_mm} onChange={handleInputChange} step="0.1" style={styles.input} />
            </div>
            <div style={styles.formField}>
              <label style={styles.label}>Cell Width (mm)</label>
              <input type="number" name="cell_w" value={formData.cell_w} onChange={handleInputChange} step="0.1" style={styles.input} />
            </div>
            <div style={styles.formField}>
              <label style={styles.label}>Cell Length (mm)</label>
              <input type="number" name="cell_l" value={formData.cell_l} onChange={handleInputChange} step="0.1" style={styles.input} />
            </div>
            <div style={styles.formField}>
              <label style={styles.label}>Printer Width (mm)</label>
              <input type="number" name="printer_w" value={formData.printer_w} onChange={handleInputChange} step="0.1" style={styles.input} />
            </div>
            <div style={styles.formField}>
              <label style={styles.label}>Printer Length (mm)</label>
              <input type="number" name="printer_l" value={formData.printer_l} onChange={handleInputChange} step="0.1" style={styles.input} />
            </div>
            <div style={styles.formField}>
              <label style={styles.label}>Base Height (mm)</label>
              <input type="number" name="base_height" value={formData.base_height} onChange={handleInputChange} step="0.1" style={styles.input} />
            </div>
            <div style={styles.formField}>
              <label style={styles.label}>Tile Gap (mm)</label>
              <input type="number" name="tile_gap_mm" value={formData.tile_gap_mm} onChange={handleInputChange} step="0.1" style={styles.input} />
            </div>
            <div style={styles.fullWidthField}>
              <label style={styles.label}>Corner Radius (mm)</label>
              <input type="number" name="cut_corner_radius" value={formData.cut_corner_radius} onChange={handleInputChange} step="0.1" style={styles.input} />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            style={{...styles.button, ...(loading ? styles.buttonDisabled : {})}}
          >
            {loading ? 'Generating Layout...' : 'Generate and Load STL'}
          </button>

          {stlUrl && (
            <button
              type="button"
              onClick={downloadSTL}
              style={styles.secondaryButton}
            >
              Download STL
            </button>
          )}
        </form>
      </div>

      <div style={styles.canvasContainer}>
        {loading && <div style={styles.loaderOverlay}>Loading preview...</div>}
        <Canvas shadows style={{ height: '100%' }} camera={{ position: [0, 150, 200], fov: 45, near: 0.1, far: 100000 }}>
          <ambientLight intensity={0.4} />
          
          {/* Key Light to catch sloped edge highlights */}
          <directionalLight 
            position={[80, 150, 50]} 
            intensity={1.2} 
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          
          {/* Soft Fill Light to avoid pure black shadows on profiles */}
          <directionalLight 
            position={[-80, 100, -50]} 
            intensity={0.4} 
          />
          
          <STLViewer url={stlUrl} controlsRef={controlsRef} />
          <CameraControls ref={controlsRef} />
        </Canvas>
      </div>
    </div>
  );
}

export default App;
