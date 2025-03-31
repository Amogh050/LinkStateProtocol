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

const NetworkVisualization: React.FC<NetworkVisualizationProps> = ({ network, packets }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodeObjectsRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const linkObjectsRef = useRef<Map<string, { line: THREE.Line, costSprite: THREE.Sprite }>>(new Map());
  const packetObjectsRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const packetIdRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  
  // Keep track of node and link counts to force re-renders
  const [nodeCount, setNodeCount] = useState(0);
  const [linkCount, setLinkCount] = useState(0);

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

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing content
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a); // Dark background
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 15;
    cameraRef.current = camera;

    // Create renderer with full size
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Ensure renderer fills the container
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    // Create controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controlsRef.current = controls;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Reduced ambient light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Increased directional light
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Add a single plane to serve as a reference
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x2a2a2a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      depthTest: false
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -0.5;
    scene.add(plane);

    // Create an infinite grid effect
    const gridSize = 100;
    const gridDivisions = 50;
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x333333, 0x444444);
    gridHelper.position.y = -0.49;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.8;
    gridHelper.material.depthWrite = false;
    gridHelper.material.depthTest = false;
    scene.add(gridHelper);

    // Add a second grid helper for the infinite effect
    const gridHelper2 = new THREE.GridHelper(gridSize, gridDivisions, 0x333333, 0x444444);
    gridHelper2.position.y = -0.49;
    gridHelper2.material.transparent = true;
    gridHelper2.material.opacity = 0.8;
    gridHelper2.material.depthWrite = false;
    gridHelper2.material.depthTest = false;
    scene.add(gridHelper2);

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    // Initial resize
    handleResize();

    // Update grid positions in animation loop
    const updateGrids = () => {
      if (!cameraRef.current) return;
      
      const cameraPosition = cameraRef.current.position;
      const gridSize = 100;
      
      // Calculate grid positions based on camera position
      const grid1X = Math.floor(cameraPosition.x / gridSize) * gridSize;
      const grid1Z = Math.floor(cameraPosition.z / gridSize) * gridSize;
      const grid2X = grid1X + gridSize;
      const grid2Z = grid1Z + gridSize;
      
      // Position the grids
      gridHelper.position.x = grid1X;
      gridHelper.position.z = grid1Z;
      gridHelper2.position.x = grid2X;
      gridHelper2.position.z = grid2Z;
    };

    // Modify the animation loop to include grid updates
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      updateGrids();
      updatePackets();
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      
      // Clear all objects
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

    // Create packet geometry
    let geometry, material, mesh;

    if (packet.type === 'HELLO') {
      // Create a smaller sphere for HELLO packets
      geometry = new THREE.SphereGeometry(0.2, 16, 16);
      material = new THREE.MeshPhongMaterial({ 
        color: 0x9c27b0, // Purple color to match button
        emissive: 0x7b1fa2,
        shininess: 50
      });
      
      mesh = new THREE.Mesh(geometry, material);
      
      // Add "HELLO" text as a label on the packet
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HELLO', 32, 16);
      }

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(0, 0.3, 0);
      sprite.scale.set(0.5, 0.25, 1);
      mesh.add(sprite);
      
      // Add a glowing effect
      const glowGeometry = new THREE.SphereGeometry(0.3, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xce93d8,
        transparent: true,
        opacity: 0.4
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      mesh.add(glowMesh);
    } else {
      // Simpler LSP packet with no additional decorations
      geometry = new THREE.SphereGeometry(0.4, 16, 16); // Slightly larger sphere for better visibility
      material = new THREE.MeshPhongMaterial({ 
        color: 0xff0000, // Pure red
        shininess: 30,
        emissive: 0xff0000,
        emissiveIntensity: 0.5 // Add a subtle glow effect
      });
      mesh = new THREE.Mesh(geometry, material);
      
      // Add simple "LSP" text as a label on the packet
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LSP', 32, 16);
      }

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(0, 0.4, 0);
      sprite.scale.set(0.5, 0.25, 1);
      mesh.add(sprite);
    }

    // Position at the source node
    mesh.position.copy(new THREE.Vector3(
      fromNode.position.x,
      fromNode.position.y,
      fromNode.position.z
    ));

    // Store target position for animation
    mesh.userData = {
      fromPos: new THREE.Vector3(
        fromNode.position.x,
        fromNode.position.y,
        fromNode.position.z
      ),
      toPos: new THREE.Vector3(
        toNode.position.x,
        toNode.position.y,
        toNode.position.z
      ),
      progress: 0,
      speed: packet.type === 'LSP' ? 0.005 : 0.015, // Slower speed for LSP packets
      packet: packet
    };

    sceneRef.current.add(mesh);

    const packetId = packetIdRef.current++;
    packetObjectsRef.current.set(packetId, mesh);

    return packetId;
  };

  const updatePackets = () => {
    if (!sceneRef.current) return;

    // Animate existing packets
    for (const [packetId, packetObject] of packetObjectsRef.current.entries()) {
      const userData = packetObject.userData;
      
      userData.progress += userData.speed;
      
      if (userData.progress >= 1) {
        // Packet reached its destination
        sceneRef.current.remove(packetObject);
        packetObjectsRef.current.delete(packetId);
      } else {
        // Update packet position along the path
        const newPos = new THREE.Vector3().lerpVectors(
          userData.fromPos,
          userData.toPos,
          userData.progress
        );
        
        // Simple straight-line movement for all packets
        packetObject.position.copy(newPos);
        
        // Simple rotation for all packets
        packetObject.rotation.y += 0.01;
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