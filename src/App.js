import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');
const TOP_RAMP_MIN_INNER_WALL_HEIGHT_DIFFERENCE = 3.8;

const generatorTabs = [
  { id: 'baseplate', label: 'Baseplate' },
  { id: 'box', label: 'Box' },
];
  
const baseplateFields = [
  { name: 'total_width_mm', label: 'Total Width (mm)' },
  { name: 'total_length_mm', label: 'Total Length (mm)' },
  { name: 'cell_w', label: 'Cell Width (mm)' },
  { name: 'cell_l', label: 'Cell Length (mm)' },
  { name: 'printer_w', label: 'Printer Width (mm)' },
  { name: 'printer_l', label: 'Printer Length (mm)' },
  { name: 'base_height', label: 'Base Height (mm)' },
  { name: 'tile_gap_mm', label: 'Tile Gap (mm)' },
  { name: 'cut_corner_radius', label: 'Corner Radius (mm)', fullWidth: true },
];

const boxFields = [
  { name: 'box_wall_thickness', label: 'Wall Thickness (mm)' },
  { name: 'box_height', label: 'Box Height (mm)' },
  { name: 'total_width_mm', label: 'Total Width (mm)' },
  { name: 'total_length_mm', label: 'Total Length (mm)' },
  { name: 'cell_w', label: 'Cell Width (mm)' },
  { name: 'cell_l', label: 'Cell Length (mm)' },
  { name: 'box_base_thickness', label: 'Base Thickness (mm)', fullWidth: true },
];

const subdivisionFields = [
  { name: 'row_subdivisions', label: 'Row Subdivisions', step: 1, min: 1 },
  { name: 'column_subdivisions', label: 'Column Subdivisions', step: 1, min: 1 },
  { name: 'inner_wall_thickness', label: 'Inner Wall Thickness (mm)' },
  { name: 'inner_wall_height_difference', label: 'Inner Wall Height Difference (mm)' },
];

const topRampPatternOptions = [
  { value: 'none', label: 'None' },
  { value: 'normal', label: 'Normal' },
];

const mergeGroupColors = ['#f97316', '#14b8a6', '#8b5cf6', '#22c55e', '#ef4444', '#0ea5e9'];

function getCellKey(row, column) {
  return `${row}:${column}`;
}

function areCellsConnected(cells) {
  if (cells.length <= 1) return false;

  const cellKeys = new Set(cells.map((cell) => getCellKey(cell.row, cell.column)));
  const visited = new Set([getCellKey(cells[0].row, cells[0].column)]);
  const frontier = [cells[0]];

  while (frontier.length) {
    const { row, column } = frontier.pop();
    [
      { row: row - 1, column },
      { row: row + 1, column },
      { row, column: column - 1 },
      { row, column: column + 1 },
    ].forEach((neighbor) => {
      const neighborKey = getCellKey(neighbor.row, neighbor.column);
      if (cellKeys.has(neighborKey) && !visited.has(neighborKey)) {
        visited.add(neighborKey);
        frontier.push(neighbor);
      }
    });
  }

  return visited.size === cells.length;
}

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

function STLViewer({ url, controlsRef, onSpecsChange }) {
  const [geometry, setGeometry] = useState(null);
  const meshRef = useRef();
  const edgeGeometry = useMemo(() => (
    geometry ? new THREE.EdgesGeometry(geometry, 35) : null
  ), [geometry]);

  useEffect(() => {
    if (url) {
      const loader = new STLLoader();
      loader.load(
        url,
        (geom) => {
          geom.center();
          geom.computeVertexNormals();
          geom.computeBoundingSphere();
          geom.computeBoundingBox();

          const dimensions = geom.boundingBox.getSize(new THREE.Vector3());
          onSpecsChange({
            width: dimensions.x,
            depth: dimensions.y,
            height: dimensions.z,
          });

          setGeometry(geom);
        },
        (progress) => {
          console.log((progress.loaded / progress.total * 100) + '% loaded');
        },
        (error) => {
          console.error('An error happened', error);
          onSpecsChange(null);
        }
      );
    } else {
      setGeometry(null);
      onSpecsChange(null);
    }
  }, [url, onSpecsChange]);

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
    <group>
      <mesh ref={meshRef} geometry={geometry} castShadow={false} receiveShadow={true}>
        <meshStandardMaterial
          color="#d97706"
          roughness={0.72}
          metalness={0}
          flatShading={true}
          side={THREE.DoubleSide}
        />
      </mesh>
      {edgeGeometry && (
        <lineSegments geometry={edgeGeometry}>
          <lineBasicMaterial color="#7c2d12" transparent opacity={0.42} />
        </lineSegments>
      )}
    </group>
  );
}

function App() {
  const [stlUrl, setStlUrl] = useState('');
  const [generatedType, setGeneratedType] = useState('baseplate');
  const [activeTab, setActiveTab] = useState('baseplate');
  const [loading, setLoading] = useState(false);
  const [objectSpecs, setObjectSpecs] = useState(null);
  const [subdivisionEnabled, setSubdivisionEnabled] = useState(false);
  const [topRampPatternEnabled, setTopRampPatternEnabled] = useState(false);
  const [selectedDivisionCells, setSelectedDivisionCells] = useState([]);
  const [joinedDivisionGroups, setJoinedDivisionGroups] = useState([]);
  const [editingJoinedGroupIndex, setEditingJoinedGroupIndex] = useState(null);
  const controlsRef = useRef();
  const viewerRef = useRef(null);
  const isMobile = useMediaQuery('(max-width: 760px)');
  const isNarrowMobile = useMediaQuery('(max-width: 380px)');
  const [baseplateFormData, setBaseplateFormData] = useState({
    total_width_mm: 80,
    total_length_mm: 80,
    cell_w: 40,
    cell_l: 40,
    printer_w: 250,
    printer_l: 250,
    base_height: 3.4,
    tile_gap_mm: 20,
    cut_corner_radius: 3.0
  });
  const [boxFormData, setBoxFormData] = useState({
    box_wall_thickness: 1,
    inner_wall_thickness: 1,
    total_width_mm: 80,
    total_length_mm: 80,
    cell_w: 40,
    cell_l: 40,
    row_subdivisions: 1,
    column_subdivisions: 1,
    inner_wall_height_difference: 0,
    box_height: 30,
    box_base_thickness: 5,
    top_ramp_pattern: 'none'
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const parsedValue = parseFloat(value) || 0;

    if (activeTab === 'baseplate') {
      setBaseplateFormData({ ...baseplateFormData, [name]: parsedValue });
    } else {
      setBoxFormData({ ...boxFormData, [name]: parsedValue });
    }
  };

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    setBoxFormData({ ...boxFormData, [name]: value });
  };

  const divisionRows = Math.max(1, Math.floor(boxFormData.row_subdivisions || 1));
  const divisionColumns = Math.max(1, Math.floor(boxFormData.column_subdivisions || 1));

  const groupedCellMap = useMemo(() => {
    const nextMap = new Map();
    joinedDivisionGroups.forEach((group, groupIndex) => {
      group.forEach((cell) => {
        nextMap.set(getCellKey(cell.row, cell.column), groupIndex);
      });
    });
    return nextMap;
  }, [joinedDivisionGroups]);

  const selectedCellSet = useMemo(() => (
    new Set(selectedDivisionCells.map((cell) => getCellKey(cell.row, cell.column)))
  ), [selectedDivisionCells]);

  useEffect(() => {
    setSelectedDivisionCells((cells) => cells.filter(
      (cell) => cell.row < divisionRows && cell.column < divisionColumns
    ));
    setJoinedDivisionGroups((groups) => groups
      .map((group) => group.filter((cell) => cell.row < divisionRows && cell.column < divisionColumns))
      .filter((group) => group.length >= 2));
    setEditingJoinedGroupIndex(null);
  }, [divisionRows, divisionColumns]);

  const toggleDivisionCell = (row, column) => {
    const key = getCellKey(row, column);
    const groupIndex = groupedCellMap.get(key);
    if (groupIndex !== undefined) {
      setEditingJoinedGroupIndex(groupIndex);
      setSelectedDivisionCells(joinedDivisionGroups[groupIndex]);
      return;
    }

    setSelectedDivisionCells((cells) => {
      const exists = cells.some((cell) => cell.row === row && cell.column === column);
      if (exists) {
        return cells.filter((cell) => cell.row !== row || cell.column !== column);
      }
      return [...cells, { row, column }];
    });
  };

  const mergeSelectedDivisionCells = () => {
    if (!areCellsConnected(selectedDivisionCells)) {
      alert('Select at least two edge-connected subdivisions to merge.');
      return;
    }

    setJoinedDivisionGroups((groups) => {
      if (editingJoinedGroupIndex === null) {
        return [...groups, selectedDivisionCells];
      }

      return groups.map((group, groupIndex) => (
        groupIndex === editingJoinedGroupIndex ? selectedDivisionCells : group
      ));
    });
    setEditingJoinedGroupIndex(null);
    setSelectedDivisionCells([]);
  };

  const clearDivisionSelection = () => {
    setEditingJoinedGroupIndex(null);
    setSelectedDivisionCells([]);
  };

  const removeJoinedDivisionGroup = (groupIndex) => {
    setJoinedDivisionGroups((groups) => groups.filter((_, index) => index !== groupIndex));
    setEditingJoinedGroupIndex(null);
    setSelectedDivisionCells([]);
  };

  const clearJoinedDivisionGroups = () => {
    setJoinedDivisionGroups([]);
    setSelectedDivisionCells([]);
    setEditingJoinedGroupIndex(null);
  };

  const joinedDivisionPayloadGroups = useMemo(() => (
    joinedDivisionGroups.map((group) => (
      group.map((cell) => ({
        row: divisionRows - 1 - cell.row,
        column: cell.column,
      }))
    ))
  ), [divisionRows, joinedDivisionGroups]);

  useEffect(() => {
    if (!stlUrl || !isMobile || !viewerRef.current) return;

    window.requestAnimationFrame(() => {
      viewerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [stlUrl, isMobile]);

  const generateSTL = async () => {
    const isBoxGenerator = activeTab === 'box';
    const submittedType = isBoxGenerator ? 'box' : 'baseplate';
    const endpoint = isBoxGenerator ? '/box_generate' : '/generate-baseplate';
    const topRampPattern = topRampPatternEnabled ? boxFormData.top_ramp_pattern : 'none';

    if (
      isBoxGenerator &&
      subdivisionEnabled &&
      topRampPattern !== 'none' &&
      boxFormData.inner_wall_height_difference < TOP_RAMP_MIN_INNER_WALL_HEIGHT_DIFFERENCE
    ) {
      alert(`Inner Wall Height Difference must be at least ${TOP_RAMP_MIN_INNER_WALL_HEIGHT_DIFFERENCE} mm when Top Ramp Pattern is not None.`);
      return;
    }

    const boxPayload = {
      box_wall_thickness: boxFormData.box_wall_thickness,
      total_width_mm: boxFormData.total_width_mm,
      total_length_mm: boxFormData.total_length_mm,
      cell_w: boxFormData.cell_w,
      cell_l: boxFormData.cell_l,
      box_height: boxFormData.box_height,
      box_base_thickness: boxFormData.box_base_thickness,
      top_ramp_pattern: topRampPattern,
      ...(subdivisionEnabled
        ? {
            inner_wall_thickness: boxFormData.inner_wall_thickness,
            row_subdivisions: boxFormData.row_subdivisions,
            column_subdivisions: boxFormData.column_subdivisions,
            inner_wall_height_difference: boxFormData.inner_wall_height_difference,
            ...(joinedDivisionGroups.length
              ? {
                  custom_divisions: {
                    rows: divisionRows,
                    columns: divisionColumns,
                    joined_cells: joinedDivisionPayloadGroups,
                  },
                }
              : {}),
          }
        : {}),
    };
    const payload = isBoxGenerator ? boxPayload : baseplateFormData;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        const downloadUrl = `${API_BASE_URL}/download/${data.request_id}`;
        setGeneratedType(submittedType);
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
      link.download = generatedType === 'box' ? 'gridfinity-box.stl' : 'gridfinity-baseplate.stl';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Error downloading STL:', error);
      alert('Failed to download STL');
    }
  };

  const formattedSpecs = objectSpecs
    ? [
        { label: 'Width', value: objectSpecs.width },
        { label: 'Depth', value: objectSpecs.depth },
        { label: 'Height', value: objectSpecs.height },
      ]
    : [];

  const styles = {
    container: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      minHeight: isMobile ? '100svh' : '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      backgroundColor: '#f8fafc',
      color: '#1e293b',
    },
    sidebar: {
      width: isMobile ? 'auto' : '420px',
      order: isMobile && stlUrl ? 2 : 1,
      maxHeight: isMobile ? 'none' : '100vh',
      boxSizing: 'border-box',
      padding: isMobile ? '16px 12px calc(18px + env(safe-area-inset-bottom))' : '32px',
      overflowY: isMobile ? 'visible' : 'auto',
      backgroundColor: '#ffffff',
      borderRight: isMobile ? 'none' : '1px solid #e2e8f0',
      borderBottom: isMobile ? '1px solid #e2e8f0' : 'none',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      display: 'flex',
      flexDirection: 'column',
    },
    title: {
      fontSize: isMobile ? '20px' : '24px',
      fontWeight: 700,
      margin: '0 0 4px 0',
      color: '#1e3a8a',
      letterSpacing: '0',
    },
    subtitle: {
      fontSize: isMobile ? '13px' : '14px',
      color: '#64748b',
      margin: isMobile ? '0 0 14px 0' : '0 0 24px 0',
    },
    tabs: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '4px',
      padding: '4px',
      marginBottom: isMobile ? '14px' : '24px',
      borderRadius: '8px',
      backgroundColor: '#e2e8f0',
    },
    tabButton: {
      minHeight: '40px',
      padding: '9px 12px',
      border: 'none',
      borderRadius: '6px',
      backgroundColor: 'transparent',
      color: '#475569',
      fontSize: '14px',
      fontWeight: 650,
      cursor: 'pointer',
      transition: 'background-color 0.2s, color 0.2s, box-shadow 0.2s',
    },
    activeTabButton: {
      backgroundColor: '#ffffff',
      color: '#1e3a8a',
      boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.12)',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: isMobile && !isNarrowMobile ? '1fr 1fr' : isMobile ? '1fr' : '1fr 1fr',
      gap: isMobile ? '10px' : '16px 12px',
    },
    formField: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    fullWidthField: {
      gridColumn: isMobile && !isNarrowMobile ? 'span 2' : isMobile ? 'auto' : 'span 2',
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
      padding: isMobile ? '10px 11px' : '10px 14px',
      borderRadius: '8px',
      border: '1px solid #cbd5e1',
      fontSize: '16px',
      outline: 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      backgroundColor: '#f8fafc',
      boxSizing: 'border-box',
      width: '100%',
    },
    select: {
      padding: isMobile ? '10px 11px' : '10px 14px',
      borderRadius: '8px',
      border: '1px solid #cbd5e1',
      fontSize: '16px',
      outline: 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      backgroundColor: '#f8fafc',
      boxSizing: 'border-box',
      width: '100%',
      cursor: 'pointer',
    },
    fieldGroup: {
      marginTop: isMobile ? '12px' : '18px',
      padding: isMobile ? '12px' : '14px',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      backgroundColor: '#f8fafc',
    },
    checkboxLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '14px',
      fontWeight: 650,
      color: '#334155',
      cursor: 'pointer',
      userSelect: 'none',
    },
    checkbox: {
      width: '16px',
      height: '16px',
      accentColor: '#2563eb',
      cursor: 'pointer',
    },
    nestedGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile && !isNarrowMobile ? '1fr 1fr' : isMobile ? '1fr' : '1fr 1fr',
      gap: isMobile ? '10px' : '16px 12px',
      marginTop: isMobile ? '12px' : '14px',
    },
    mergePanel: {
      gridColumn: isMobile && !isNarrowMobile ? 'span 2' : isMobile ? 'auto' : 'span 2',
      marginTop: '2px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    divisionGrid: {
      display: 'grid',
      gridTemplateColumns: `repeat(${divisionColumns}, minmax(${isMobile ? '42px' : '26px'}, 1fr))`,
      gap: isMobile ? '6px' : '5px',
      padding: isMobile ? '8px' : '10px',
      borderRadius: '8px',
      border: '1px solid #cbd5e1',
      backgroundColor: '#ffffff',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
    },
    divisionCell: {
      aspectRatio: '1 / 1',
      minWidth: 0,
      minHeight: isMobile ? '42px' : '26px',
      border: '1px solid #cbd5e1',
      borderRadius: '6px',
      backgroundColor: '#f8fafc',
      cursor: 'pointer',
      fontSize: isMobile ? '12px' : '11px',
      fontWeight: 700,
      color: '#475569',
      fontVariantNumeric: 'tabular-nums',
      transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s',
    },
    divisionCellSelected: {
      backgroundColor: '#dbeafe',
      borderColor: '#2563eb',
      color: '#1e3a8a',
      boxShadow: 'inset 0 0 0 2px #2563eb',
    },
    divisionCellMerged: {
      color: '#ffffff',
      borderColor: 'rgba(15, 23, 42, 0.18)',
    },
    divisionCellEditing: {
      boxShadow: 'inset 0 0 0 3px #0f172a',
    },
    mergeActions: {
      display: 'grid',
      gridTemplateColumns: isMobile && !isNarrowMobile ? '1fr 1fr' : isMobile ? '1fr' : '1fr 1fr',
      gap: '8px',
    },
    compactButton: {
      minHeight: isMobile ? '44px' : 'auto',
      padding: isMobile ? '10px 12px' : '9px 12px',
      borderRadius: '8px',
      border: '1px solid #bfdbfe',
      backgroundColor: '#ffffff',
      color: '#2563eb',
      fontSize: '13px',
      fontWeight: 650,
      cursor: 'pointer',
    },
    compactButtonDisabled: {
      color: '#94a3b8',
      borderColor: '#e2e8f0',
      cursor: 'not-allowed',
    },
    mergeGroupList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    mergeGroupItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      padding: isMobile ? '10px' : '8px 10px',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      backgroundColor: '#ffffff',
      fontSize: '13px',
      color: '#475569',
    },
    mergeGroupText: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    removeGroupButton: {
      flex: '0 0 auto',
      width: isMobile ? '34px' : '26px',
      height: isMobile ? '34px' : '26px',
      borderRadius: '6px',
      border: '1px solid #fecaca',
      backgroundColor: '#fff1f2',
      color: '#b91c1c',
      fontWeight: 800,
      cursor: 'pointer',
      lineHeight: 1,
    },
    helperText: {
      margin: 0,
      fontSize: '12px',
      lineHeight: 1.45,
      color: '#64748b',
    },
    button: {
      marginTop: isMobile ? '14px' : '24px',
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
      flex: '0 0 auto',
      order: isMobile && stlUrl ? 1 : 2,
      width: isMobile ? '100%' : 'min(calc(100vw - 420px), 100vh)',
      maxWidth: isMobile ? '100%' : 'calc(100vw - 420px)',
      aspectRatio: '1 / 1',
      backgroundColor: '#f1f5f9',
      position: 'relative',
      alignSelf: isMobile ? 'stretch' : 'center',
      margin: isMobile ? 0 : 'auto',
      overflow: 'hidden',
      borderBottom: isMobile ? '1px solid #e2e8f0' : 'none',
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
    },
    specsOverlay: {
      position: 'absolute',
      right: isMobile ? '12px' : '20px',
      bottom: isMobile ? '12px' : '20px',
      minWidth: isMobile ? '142px' : '190px',
      padding: isMobile ? '9px 10px' : '12px 14px',
      borderRadius: '8px',
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      border: '1px solid rgba(226, 232, 240, 0.9)',
      boxShadow: '0 8px 18px -10px rgb(15 23 42 / 0.45)',
      zIndex: 10,
    },
    specsTitle: {
      margin: '0 0 8px 0',
      fontSize: isMobile ? '12px' : '13px',
      fontWeight: 700,
      color: '#334155',
    },
    specsRow: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '14px',
      fontSize: isMobile ? '12px' : '13px',
      lineHeight: 1.55,
      color: '#475569',
    },
    specsValue: {
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 650,
      color: '#0f172a',
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
        select:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
          background-color: #ffffff !important;
        }
        button:hover:not(:disabled) {
          background-color: #1d4ed8 !important;
        }
        .subdivision-cell:hover:not(:disabled) {
          border-color: #2563eb !important;
          background-color: #eff6ff !important;
        }
        .compact-action:hover:not(:disabled) {
          background-color: #eff6ff !important;
        }
        .remove-merge-group:hover:not(:disabled) {
          background-color: #fee2e2 !important;
        }
        .generator-tab:hover:not(:disabled) {
          background-color: #ffffff !important;
        }
        button:active:not(:disabled) {
          transform: translateY(1px);
        }
      `}</style>

      <div style={styles.sidebar}>
        <h1 style={styles.title}>Gridfinity Generator</h1>
        <p style={styles.subtitle}>
          Customize parameters to build your {activeTab === 'box' ? 'grid-compatible box.' : 'configuration baseplate.'}
        </p>

        <div style={styles.tabs} role="tablist" aria-label="Generator type">
          {generatorTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="generator-tab"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.tabButton,
                ...(activeTab === tab.id ? styles.activeTabButton : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); generateSTL(); }} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={styles.grid}>
            {(activeTab === 'baseplate' ? baseplateFields : boxFields).map((field) => {
              const fieldValue = activeTab === 'baseplate'
                ? baseplateFormData[field.name]
                : boxFormData[field.name];

              return (
                <div key={field.name} style={field.fullWidth ? styles.fullWidthField : styles.formField}>
                  <label style={styles.label}>{field.label}</label>
                  <input
                    type="number"
                    name={field.name}
                    value={fieldValue}
                    onChange={handleInputChange}
                    step={field.step || 0.1}
                    min={field.min || 0}
                    style={styles.input}
                  />
                </div>
              );
            })}
          </div>

          {activeTab === 'box' && (
            <>
              <div style={styles.fieldGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={subdivisionEnabled}
                    onChange={(e) => setSubdivisionEnabled(e.target.checked)}
                    style={styles.checkbox}
                  />
                  Box Sub-Division Feature
                </label>

                {subdivisionEnabled && (
                  <div style={styles.nestedGrid}>
                    {subdivisionFields.map((field) => (
                      <div key={field.name} style={field.fullWidth ? styles.fullWidthField : styles.formField}>
                        <label style={styles.label}>{field.label}</label>
                        <input
                          type="number"
                          name={field.name}
                          value={boxFormData[field.name]}
                          onChange={handleInputChange}
                          step={field.step || 0.1}
                          min={field.min || 0}
                          style={styles.input}
                        />
                      </div>
                    ))}
                    <div style={styles.mergePanel}>
                      <label style={styles.label}>Merge Subdivisions</label>
                      <div
                        style={styles.divisionGrid}
                        role="grid"
                        aria-label="Subdivision merge grid"
                      >
                        {Array.from({ length: divisionRows }).map((_, row) => (
                          Array.from({ length: divisionColumns }).map((__, column) => {
                            const cellKey = getCellKey(row, column);
                            const groupIndex = groupedCellMap.get(cellKey);
                            const isMerged = groupIndex !== undefined;
                            const isSelected = selectedCellSet.has(cellKey);
                            const isEditingGroupCell = isMerged && groupIndex === editingJoinedGroupIndex;
                            const groupColor = isMerged
                              ? mergeGroupColors[groupIndex % mergeGroupColors.length]
                              : undefined;

                            return (
                              <button
                                key={cellKey}
                                type="button"
                                className="subdivision-cell"
                                onClick={() => toggleDivisionCell(row, column)}
                                title={isMerged ? `Edit merged group ${groupIndex + 1}` : `Row ${row + 1}, column ${column + 1}`}
                                style={{
                                  ...styles.divisionCell,
                                  ...(isSelected ? styles.divisionCellSelected : {}),
                                  ...(isMerged ? { ...styles.divisionCellMerged, backgroundColor: groupColor } : {}),
                                  ...(isEditingGroupCell ? styles.divisionCellEditing : {}),
                                }}
                              >
                                {row + 1}.{column + 1}
                              </button>
                            );
                          })
                        ))}
                      </div>
                      <div style={styles.mergeActions}>
                        <button
                          type="button"
                          className="compact-action"
                          onClick={mergeSelectedDivisionCells}
                          disabled={selectedDivisionCells.length < 2}
                          style={{
                            ...styles.compactButton,
                            ...(selectedDivisionCells.length < 2 ? styles.compactButtonDisabled : {}),
                          }}
                        >
                          {editingJoinedGroupIndex === null ? 'Merge Selected' : 'Save Merge'}
                        </button>
                        <button
                          type="button"
                          className="compact-action"
                          onClick={selectedDivisionCells.length ? clearDivisionSelection : clearJoinedDivisionGroups}
                          disabled={!selectedDivisionCells.length && !joinedDivisionGroups.length}
                          style={{
                            ...styles.compactButton,
                            ...(!selectedDivisionCells.length && !joinedDivisionGroups.length ? styles.compactButtonDisabled : {}),
                          }}
                        >
                          {selectedDivisionCells.length ? 'Clear Selection' : 'Clear Merges'}
                        </button>
                      </div>
                      {joinedDivisionGroups.length > 0 ? (
                        <div style={styles.mergeGroupList}>
                          {joinedDivisionGroups.map((group, groupIndex) => (
                            <div key={`${groupIndex}-${group.map((cell) => getCellKey(cell.row, cell.column)).join('-')}`} style={styles.mergeGroupItem}>
                              <span style={styles.mergeGroupText}>
                                Group {groupIndex + 1}: {group.map((cell) => `${cell.row + 1}.${cell.column + 1}`).join(', ')}
                              </span>
                              <button
                                type="button"
                                className="remove-merge-group"
                                onClick={() => removeJoinedDivisionGroup(groupIndex)}
                                style={styles.removeGroupButton}
                                aria-label={`Remove merged group ${groupIndex + 1}`}
                              >
                                x
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={styles.helperText}>Click adjacent cells, then merge them to remove the divider walls between those subdivisions.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={topRampPatternEnabled}
                    onChange={(e) => setTopRampPatternEnabled(e.target.checked)}
                    style={styles.checkbox}
                  />
                  Top Ramp Pattern
                </label>

                {topRampPatternEnabled && (
                  <div style={styles.nestedGrid}>
                    <div style={styles.fullWidthField}>
                      <label style={styles.label}>Pattern</label>
                      <select
                        name="top_ramp_pattern"
                        value={boxFormData.top_ramp_pattern}
                        onChange={handleSelectChange}
                        style={styles.select}
                      >
                        {topRampPatternOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          
          <button 
            type="submit" 
            disabled={loading} 
            style={{...styles.button, ...(loading ? styles.buttonDisabled : {})}}
          >
            {loading ? 'Generating Layout...' : `Generate ${activeTab === 'box' ? 'Box' : 'Baseplate'} STL`}
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

      <div ref={viewerRef} style={styles.canvasContainer}>
        {loading && <div style={styles.loaderOverlay}>Loading preview...</div>}
        {objectSpecs && (
          <div style={styles.specsOverlay}>
            <p style={styles.specsTitle}>Object Specs</p>
            {formattedSpecs.map((spec) => (
              <div key={spec.label} style={styles.specsRow}>
                <span>{spec.label}</span>
                <span style={styles.specsValue}>{spec.value.toFixed(1)} mm</span>
              </div>
            ))}
          </div>
        )}
        <Canvas shadows={false} style={{ height: '100%' }} camera={{ position: [0, 150, 200], fov: 45, near: 0.1, far: 100000 }}>
          <ambientLight intensity={0.4} />
          
          {/* Key Light to catch sloped edge highlights */}
          <directionalLight 
              position={[80, 150, 50]} 
              intensity={1.2}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-bias={-0.0005}
              shadow-normalBias={0.02}
          />
          
          {/* Soft Fill Light to avoid pure black shadows on profiles */}
          <directionalLight 
            position={[-80, 100, -50]} 
            intensity={0.4} 
          />
          
          <STLViewer url={stlUrl} controlsRef={controlsRef} onSpecsChange={setObjectSpecs} />
          <CameraControls ref={controlsRef} />
        </Canvas>
      </div>
    </div>
  );
}

export default App;
