class NetworkVisualization {
    constructor(containerElement, network) {
        this.container = containerElement;
        this.network = network;
        this.nodeObjects = new Map(); // Map of nodeId -> THREE.Mesh
        this.linkObjects = new Map(); // Map of "nodeId1-nodeId2" -> THREE.Line
        this.packetObjects = new Map(); // Map of packetId -> THREE.Mesh
        this.packetId = 0;
        
        this.initScene();
        this.initLights();
        this.initControls();
        
        this.animate();
    }
    
    initScene() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            this.container.clientWidth / this.container.clientHeight, 
            0.1, 
            1000
        );
        this.camera.position.z = 15;
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        });
        
        // Create a grid helper
        const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc);
        gridHelper.position.y = -2;
        this.scene.add(gridHelper);
    }
    
    initLights() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
    }
    
    initControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
    }
    
    createNodeObject(node) {
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
        ctx.fillStyle = 'white';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.id.toString(), 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(0, 0.7, 0);
        sprite.scale.set(0.5, 0.5, 1);
        mesh.add(sprite);
        
        this.scene.add(mesh);
        this.nodeObjects.set(node.id, mesh);
        
        return mesh;
    }
    
    createLinkObject(nodeId1, nodeId2, cost) {
        const node1 = this.network.getNode(nodeId1);
        const node2 = this.network.getNode(nodeId2);
        
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
        ctx.fillStyle = 'black';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cost.toString(), 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const costSprite = new THREE.Sprite(spriteMaterial);
        costSprite.position.copy(midpoint);
        costSprite.scale.set(0.5, 0.5, 1);
        
        this.scene.add(line);
        this.scene.add(costSprite);
        
        const linkKey = `${Math.min(nodeId1, nodeId2)}-${Math.max(nodeId1, nodeId2)}`;
        this.linkObjects.set(linkKey, { line, costSprite });
        
        return line;
    }
    
    createPacketObject(packet) {
        const fromNode = this.network.getNode(packet.from);
        const toNode = this.network.getNode(packet.to);
        
        if (!fromNode || !toNode) return null;
        
        // Create packet geometry
        let geometry, material;
        
        if (packet.type === 'HELLO') {
            geometry = new THREE.SphereGeometry(0.2, 16, 16);
            material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        } else if (packet.type === 'LSP') {
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
        
        this.scene.add(mesh);
        
        const packetId = this.packetId++;
        this.packetObjects.set(packetId, mesh);
        
        return packetId;
    }
    
    updateNodeObject(nodeId) {
        const node = this.network.getNode(nodeId);
        if (!node) return;
        
        const nodeObject = this.nodeObjects.get(nodeId);
        if (nodeObject) {
            // Update node color based on active state
            const material = nodeObject.material;
            material.color = node.active ? node.color : new THREE.Color(0x888888);
            material.emissive = node.active ? 
                node.color.clone().multiplyScalar(0.2) : 
                new THREE.Color(0x222222);
            material.needsUpdate = true;
        }
    }
    
    updateLinkObject(nodeId1, nodeId2) {
        const linkKey = `${Math.min(nodeId1, nodeId2)}-${Math.max(nodeId1, nodeId2)}`;
        const linkObject = this.linkObjects.get(linkKey);
        
        if (linkObject) {
            const node1 = this.network.getNode(nodeId1);
            const node2 = this.network.getNode(nodeId2);
            
            if (node1 && node2) {
                // Update link geometry
                const points = [
                    new THREE.Vector3(node1.position.x, node1.position.y, node1.position.z),
                    new THREE.Vector3(node2.position.x, node2.position.y, node2.position.z)
                ];
                
                linkObject.line.geometry.setFromPoints(points);
                
                // Update cost label position
                const midpoint = new THREE.Vector3().addVectors(
                    points[0], points[1]
                ).multiplyScalar(0.5);
                
                linkObject.costSprite.position.copy(midpoint);
                
                // Update color based on node active states
                const bothActive = node1.active && node2.active;
                linkObject.line.material.color = new THREE.Color(bothActive ? 0x888888 : 0xcccccc);
            }
        }
    }
    
    updatePackets() {
        const packetsToRemove = [];
        
        for (const [packetId, packetObject] of this.packetObjects.entries()) {
            packetObject.userData.progress += packetObject.userData.speed;
            
            if (packetObject.userData.progress >= 1) {
                // Packet reached destination
                packetsToRemove.push(packetId);
            } else {
                // Update packet position
                packetObject.position.lerpVectors(
                    packetObject.userData.fromPos,
                    packetObject.userData.toPos,
                    packetObject.userData.progress
                );
            }
        }
        
        // Remove completed packets
        for (const packetId of packetsToRemove) {
            const packetObject = this.packetObjects.get(packetId);
            this.scene.remove(packetObject);
            this.packetObjects.delete(packetId);
        }
    }
    
    updateVisualization() {
        // Update all nodes
        for (const nodeId of this.network.nodes.keys()) {
            if (!this.nodeObjects.has(nodeId)) {
                this.createNodeObject(this.network.getNode(nodeId));
            } else {
                this.updateNodeObject(nodeId);
            }
        }
        
        // Update all links
        for (const node of this.network.nodes.values()) {
            for (const [neighborId] of node.links.entries()) {
                const linkKey = `${Math.min(node.id, neighborId)}-${Math.max(node.id, neighborId)}`;
                
                if (!this.linkObjects.has(linkKey)) {
                    const cost = node.links.get(neighborId);
                    this.createLinkObject(node.id, neighborId, cost);
                } else {
                    this.updateLinkObject(node.id, neighborId);
                }
            }
        }
        
        // Update packets
        this.updatePackets();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.updateVisualization();
        this.renderer.render(this.scene, this.camera);
    }
    
    visualizePackets(packets) {
        for (const packet of packets) {
            this.createPacketObject(packet);
        }
    }
}