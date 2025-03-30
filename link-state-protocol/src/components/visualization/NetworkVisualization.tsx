import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Network } from '../../models/Network';
import { Packet } from '../../models/types';

interface NetworkVisualizationProps {
  network: Network;
  packets: Packet[];
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

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
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

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controlsRef.current = controls;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc);
    gridHelper.position.y = -2;
    scene.add(gridHelper);

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
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

  // Update visualization when network changes
  useEffect(() => {
    updateVisualization();
  }, [network]);

  // Update visualization when packets change
  useEffect(() => {
    visualizePackets(packets);
  }, [packets]);

  const createNodeObject = (node: any) => {
    if (!sceneRef.current) return null;

    // Create node geometry
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: node.color,
      emissive: node.color.clone().multiplyScalar(0.2)
    });
    const mesh = new THREE.Mesh(geometry, material);

    // Position the node
    mesh.position.set(node.position.x, node.position.y, node.position.z);

    // Add node ID text as a simple canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.id.toString(), 32, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(0, 0.7, 0);
    sprite.scale.set(0.5, 0.5, 1);
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
      color: 0x888888,
      linewidth: 2
    });

    const line = new THREE.Line(geometry, material);

    // Add cost label as a sprite
    const midpoint = new THREE.Vector3().addVectors(
      points[0], points[1]
    ).multiplyScalar(0.5);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'black';
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cost.toString(), 32, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const costSprite = new THREE.Sprite(spriteMaterial);
    costSprite.position.copy(midpoint);
    costSprite.scale.set(0.5, 0.5, 1);

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
    let geometry, material;

    if (packet.type === 'HELLO') {
      geometry = new THREE.SphereGeometry(0.2, 16, 16);
      material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    } else {
      geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
      material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    }

    const mesh = new THREE.Mesh(geometry, material);

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
      speed: 0.02,
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
        
        packetObject.position.copy(newPos);
      }
    }
  };

  const updateVisualization = () => {
    if (!sceneRef.current) return;

    // Create/update nodes
    for (const node of network.nodes.values()) {
      if (!nodeObjectsRef.current.has(node.id)) {
        createNodeObject(node);
      }
    }

    // Remove nodes that no longer exist
    for (const nodeId of nodeObjectsRef.current.keys()) {
      if (!network.nodes.has(nodeId)) {
        const nodeObject = nodeObjectsRef.current.get(nodeId);
        if (nodeObject && sceneRef.current) {
          sceneRef.current.remove(nodeObject);
          nodeObjectsRef.current.delete(nodeId);
        }
      }
    }

    // Create/update links
    for (const node of network.nodes.values()) {
      for (const [linkedNodeId, cost] of node.links.entries()) {
        if (node.id < linkedNodeId) { // Avoid duplicate links
          const linkKey = `${node.id}-${linkedNodeId}`;
          if (!linkObjectsRef.current.has(linkKey)) {
            createLinkObject(node.id, linkedNodeId, cost);
          }
        }
      }
    }

    // Remove links that no longer exist
    for (const linkKey of linkObjectsRef.current.keys()) {
      const [nodeId1Str, nodeId2Str] = linkKey.split('-');
      const nodeId1 = parseInt(nodeId1Str);
      const nodeId2 = parseInt(nodeId2Str);
      
      const node1 = network.getNode(nodeId1);
      const node2 = network.getNode(nodeId2);
      
      if (!node1 || !node2 || !node1.links.has(nodeId2)) {
        const linkObject = linkObjectsRef.current.get(linkKey);
        if (linkObject && sceneRef.current) {
          sceneRef.current.remove(linkObject.line);
          sceneRef.current.remove(linkObject.costSprite);
          linkObjectsRef.current.delete(linkKey);
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
    <div className="visualization-container" ref={containerRef} style={{ width: '100%', height: '500px' }} />
  );
};

export default NetworkVisualization; 