import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Network } from '../../models/Network';
import { Packet } from '../../models/types';

interface NetworkVisualizationProps {
  network: Network;
  packets: Packet[];
  key?: string;
}

interface LinkObject {
  line: THREE.Mesh | THREE.Line;
  costSprite: THREE.Sprite;
}

const NetworkVisualization: React.FC<NetworkVisualizationProps> = ({ network, packets }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodeObjectsRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const linkObjectsRef = useRef<Map<string, LinkObject>>(new Map());
  const packetObjectsRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const packetIdRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  
  // Keep track of node and link counts to force re-renders
  const [nodeCount, setNodeCount] = useState(0);
  const [linkCount, setLinkCount] = useState(0);

  // Add performance monitoring
  const [fps, setFps] = useState<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);

  // Force rerender when network changes
  useEffect(() => {
    const currentNodeCount = network.nodes.size;
    let currentLinkCount = 0;
    
    // Count all links in the network
    for (const node of network.nodes.values()) {
      currentLinkCount += node.links.size;
    }
    // Links are bidirectional, so divide by 2 to get actual link count
    currentLinkCount = Math.floor(currentLinkCount / 2);
    
    // Update state if counts have changed, forcing a re-render
    if (nodeCount !== currentNodeCount) {
      setNodeCount(currentNodeCount);
    }
    
    if (linkCount !== currentLinkCount) {
      setLinkCount(currentLinkCount);
    }
  }, [network, network.nodes, nodeCount, linkCount]);

  // Initialize Three.js scene with optimizations
  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing content
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }

    // Create scene with fog for depth perception
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    scene.fog = new THREE.Fog(0x1a1a1a, 15, 30);
    sceneRef.current = scene;

    // Create camera with optimized near/far planes
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      50
    );
    camera.position.z = 15;
    cameraRef.current = camera;

    // Create renderer with optimizations
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio
    renderer.shadowMap.enabled = false; // Disable shadows for performance
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create controls with optimized settings
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 5;
    controls.maxDistance = 30;
    controlsRef.current = controls;

    // Add optimized lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Add optimized reference plane
    const planeGeometry = new THREE.PlaneGeometry(100, 100, 1, 1);
    const planeMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x2a2a2a,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -0.5;
    scene.add(plane);

    // Create optimized grid
    const gridHelper = new THREE.GridHelper(100, 50, 0x333333, 0x444444);
    gridHelper.position.y = -0.49;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.8;
    gridHelper.material.depthWrite = false;
    scene.add(gridHelper);

    // Handle window resize with debouncing
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Optimized animation loop with delta time and FPS monitoring
    const animate = (currentTime: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      // Calculate delta time for smooth animations
      const deltaTime = (currentTime - lastUpdateTimeRef.current) / 1000;
      lastUpdateTimeRef.current = currentTime;

      // Update FPS counter
      frameCountRef.current++;
      if (currentTime - lastFpsUpdateRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = currentTime;
      }
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      // Update all animations with delta time
      updatePackets();

      // Update all link animations
      for (const linkObject of linkObjectsRef.current.values()) {
        if (linkObject.line.userData.update) {
          linkObject.line.userData.update(deltaTime);
        }
      }
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate(0);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      
      // Dispose of geometries and materials
      nodeObjectsRef.current.forEach(node => {
        node.geometry.dispose();
        if (Array.isArray(node.material)) {
          node.material.forEach(m => m.dispose());
        } else {
          node.material.dispose();
        }
      });
      
      linkObjectsRef.current.forEach(link => {
        if (link.line instanceof THREE.Mesh) {
          link.line.geometry.dispose();
          if (Array.isArray(link.line.material)) {
            link.line.material.forEach(m => m.dispose());
          } else {
            link.line.material.dispose();
          }
        }
        link.costSprite.material.dispose();
      });
      
      nodeObjectsRef.current.clear();
      linkObjectsRef.current.clear();
      packetObjectsRef.current.clear();
    };
  }, []);

  // Update visualization when network changes (nodes and links)
  useEffect(() => {
    if (sceneRef.current) {
      // Clear existing visualization before updating
      for (const nodeObject of nodeObjectsRef.current.values()) {
        sceneRef.current.remove(nodeObject);
      }
      nodeObjectsRef.current.clear();
      
      for (const linkObject of linkObjectsRef.current.values()) {
        sceneRef.current.remove(linkObject.line);
        sceneRef.current.remove(linkObject.costSprite);
      }
      linkObjectsRef.current.clear();
      
      // Rebuild the visualization
      updateVisualization();
    }
  }, [nodeCount, linkCount]);

  // Update visualization when packets change
  useEffect(() => {
    visualizePackets(packets);
  }, [packets]);

  const createNodeObject = (node: any) => {
    if (!sceneRef.current) return null;

    // Create node geometry
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color:  0x00ffff, // Changed to Deep Sky Blue (brighter blue)
      emissive: node.color ? node.color.clone().multiplyScalar(0.2) : new THREE.Color(0x00BFFF),
      shininess: 30
    });
    const mesh = new THREE.Mesh(geometry, material);

    // Position the node
    mesh.position.set(node.position.x, node.position.y, node.position.z);

    // Add node ID text as a simple canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff'; // White text
      ctx.font = 'bold 64px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.id.toString(), 64, 64);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(0, 0.7, 0);
    sprite.scale.set(0.8, 0.8, 1);
    mesh.add(sprite);

    sceneRef.current.add(mesh);
    nodeObjectsRef.current.set(node.id, mesh);

    return mesh;
  };

  const createLinkObject = (nodeId1: number, nodeId2: number, cost: number) => {
    if (!sceneRef.current) return null;

    const node1 = network.getNode(nodeId1);
    const node2 = network.getNode(nodeId2);

    if (!node1 || !node2) return null;

    // Create link geometry
    const points = [
      new THREE.Vector3(node1.position.x, node1.position.y, node1.position.z),
      new THREE.Vector3(node2.position.x, node2.position.y, node2.position.z)
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff, // Lighter gray for better visibility
      linewidth: 10 // Increased from 3 to 5
    });

    const line = new THREE.Line(geometry, material);

    // Add cost label as a sprite
    const midpoint = new THREE.Vector3().addVectors(
      points[0], points[1]
    ).multiplyScalar(0.5);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff'; // White text
      ctx.font = 'bold 64px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cost.toString(), 64, 64);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    const costSprite = new THREE.Sprite(spriteMaterial);
    costSprite.position.copy(midpoint);
    costSprite.scale.set(0.8, 0.8, 1);

    sceneRef.current.add(line);
    sceneRef.current.add(costSprite);

    const linkKey = `${Math.min(nodeId1, nodeId2)}-${Math.max(nodeId1, nodeId2)}`;
    linkObjectsRef.current.set(linkKey, { line, costSprite });

    return line;
  };

  const createPacketObject = (packet: Packet) => {
    if (!sceneRef.current) return null;

    const fromNode = network.getNode(packet.from);
    const toNode = network.getNode(packet.to);

    if (!fromNode || !toNode) return null;

    // Create a simple sphere with enhanced glow
    const geometry = new THREE.SphereGeometry(0.15, 16, 16); // Slightly smaller core sphere
    const material = new THREE.MeshPhongMaterial({
      color: 0xff0000,  // Red color
      emissive: 0xff0000,  // Stronger red glow
      emissiveIntensity: 0.5,  // Increased glow intensity
      shininess: 80
    });
    
    const mesh = new THREE.Mesh(geometry, material);

    // Add glow effect using a larger transparent sphere
    const glowGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    mesh.add(glowMesh);

    // Calculate path for packet movement
    const start = new THREE.Vector3(fromNode.position.x, fromNode.position.y, fromNode.position.z);
    const end = new THREE.Vector3(toNode.position.x, toNode.position.y, toNode.position.z);
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const distance = start.distanceTo(end);
    midPoint.y += distance * 0.15; // Slight curve upward
    
    const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
    mesh.userData.curve = curve;
    mesh.position.copy(start);

    // Store animation data with faster speed
    mesh.userData.fromPos = start;
    mesh.userData.toPos = end;
    mesh.userData.progress = 0;
    mesh.userData.speed = packet.type === 'HELLO' ? 0.04 : 0.02; // Faster speed for HELLO packets
    mesh.userData.packet = packet;

    // Add pulsing animation data
    mesh.userData.pulseTime = 0;

    sceneRef.current.add(mesh);

    const packetId = packetIdRef.current++;
    packetObjectsRef.current.set(packetId, mesh);

    return packetId;
  };

  const updatePackets = () => {
    if (!sceneRef.current) return;

    for (const [packetId, packetObject] of packetObjectsRef.current.entries()) {
      const userData = packetObject.userData;
      userData.progress += userData.speed;
      
      if (userData.progress >= 1) {
        // Packet reached destination
        sceneRef.current.remove(packetObject);
        packetObjectsRef.current.delete(packetId);
      } else {
        // Update packet position along curve
        const position = userData.curve.getPoint(userData.progress);
        packetObject.position.copy(position);
      }
    }
  };

  const updateVisualization = () => {
    if (!sceneRef.current) return;

    console.log(`Updating visualization: ${nodeCount} nodes, ${linkCount} links`);

    // Create nodes
    for (const node of network.nodes.values()) {
      createNodeObject(node);
    }

    // Create links
    for (const node of network.nodes.values()) {
      for (const [linkedNodeId, cost] of node.links.entries()) {
        if (node.id < linkedNodeId) { // Avoid duplicate links
          createLinkObject(node.id, linkedNodeId, cost);
        }
      }
    }
  };

  const visualizePackets = (packets: Packet[]) => {
    for (const packet of packets) {
      createPacketObject(packet);
    }
  };

  return (
    <div 
      className="visualization-container" 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        overflow: 'hidden'
      }} 
    />
  );
};

export default NetworkVisualization;